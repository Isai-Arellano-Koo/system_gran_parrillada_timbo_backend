import { Op, type Transaction } from "sequelize";
import {
  Order,
  OrderTable,
  Table,
  TableGroup,
  TableGroupChange,
  TableGroupMember,
  TableStatusChange,
  User,
} from "../../models";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";

const OPEN = ["en_edicion", "confirmado"] as const;

type TableRow = {
  id: number;
  number: number;
  capacity: number | null;
  is_active: boolean;
  group_id: number | null;
  group_numbers: number[];
  occupied: boolean;
  group_created_by: number | null;
  can_ungroup: boolean;
};

type TableChangeRow = {
  id: string;
  kind: "disponibilidad" | "agrupacion";
  at: Date | string | null;
  table_number: number | null;
  detail: string;
  reason: string;
  user_name: string;
};

const occupiedTableIds = async (t?: Transaction) => {
  const open = await Order.findAll({
    where: {
      modality: "mesa",
      status: { [Op.in]: [...OPEN] },
    },
    include: [
      { model: Table, as: "tables", through: { attributes: [] }, required: false },
    ],
    transaction: t,
  });
  const ids = new Set<number>();
  for (const order of open) {
    if (order.table_id) ids.add(order.table_id);
    const linked = (order.get("tables") as Table[] | undefined) || [];
    for (const table of linked) ids.add(table.id);
  }
  const extra = await OrderTable.findAll({
    include: [
      {
        model: Order,
        as: "order",
        required: true,
        where: { status: { [Op.in]: [...OPEN] } },
      },
    ],
    transaction: t,
  });
  for (const link of extra) ids.add(link.table_id);
  return ids;
};

const assertFree = async (tableIds: number[], t: Transaction) => {
  const occupied = await occupiedTableIds(t);
  const blocked = tableIds.filter((id) => occupied.has(id));
  if (blocked.length) {
    throw new AppError(
      "Hay un pedido abierto en esa mesa. Ciérralo o libéralo antes de cambiarla"
    );
  }
};

export const tableIdsInSameGroup = async (tableId: number, t?: Transaction) => {
  const member = await TableGroupMember.findOne({
    where: { table_id: tableId },
    transaction: t,
  });
  if (!member) return [tableId];
  const rows = await TableGroupMember.findAll({
    where: { group_id: member.group_id },
    include: [{ model: Table, as: "table" }],
    transaction: t,
  });
  const ids = rows
    .map((row) => row.table_id)
    .filter((id) => Number.isFinite(id));
  return ids.length ? [...new Set(ids)] : [tableId];
};

export const mergeIntoGroup = async (
  tableIds: number[],
  userId: number,
  role: UserRole,
  t: Transaction
) => {
  const unique = [...new Set(tableIds.map(Number).filter((id) => id > 0))];
  if (unique.length < 2) {
    throw new AppError("Elige al menos dos mesas para agrupar");
  }

  const tables = await Table.findAll({
    where: { id: { [Op.in]: unique } },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (tables.length !== unique.length) {
    throw new AppError("Mesa no válida", 404);
  }
  if (tables.some((table) => !table.is_active)) {
    throw new AppError("No se puede agrupar una mesa inhabilitada");
  }
  await assertFree(unique, t);

  const existing = await TableGroupMember.findAll({
    where: { table_id: { [Op.in]: unique } },
    transaction: t,
  });
  const groupIds = [...new Set(existing.map((row) => row.group_id))];
  if (groupIds.length) {
    const groups = await TableGroup.findAll({
      where: { id: { [Op.in]: groupIds } },
      transaction: t,
    });
    if (role !== "admin") {
      const locked = groups.find((group) => group.created_by !== userId);
      if (locked) {
        throw new AppError(
          "Ese grupo lo armó administración. Solo puedes unir mesas libres o un grupo que tú formaste"
        );
      }
    }
  }
  const extraMembers =
    groupIds.length > 0
      ? await TableGroupMember.findAll({
          where: { group_id: { [Op.in]: groupIds } },
          transaction: t,
        })
      : [];
  const allIds = [
    ...new Set([...unique, ...extraMembers.map((row) => row.table_id)]),
  ];
  await assertFree(allIds, t);

  let group: TableGroup;
  if (groupIds.length === 1) {
    group = (await TableGroup.findByPk(groupIds[0], { transaction: t }))!;
  } else {
    group = await TableGroup.create({ created_by: userId }, { transaction: t });
    if (groupIds.length > 1) {
      await TableGroupMember.update(
        { group_id: group.id },
        { where: { group_id: { [Op.in]: groupIds } }, transaction: t }
      );
      await TableGroup.destroy({
        where: { id: { [Op.in]: groupIds } },
        transaction: t,
      });
    }
  }

  for (const tableId of allIds) {
    const row = await TableGroupMember.findOne({
      where: { table_id: tableId },
      transaction: t,
    });
    if (!row) {
      await TableGroupMember.create(
        { group_id: group.id, table_id: tableId },
        { transaction: t }
      );
    } else if (row.group_id !== group.id) {
      row.group_id = group.id;
      await row.save({ transaction: t });
    }
  }

  const allTables = await Table.findAll({
    where: { id: { [Op.in]: allIds } },
    transaction: t,
  });
  await TableGroupChange.create(
    {
      group_id: group.id,
      action: "agrupar",
      table_ids: allTables
        .map((table) => table.number)
        .sort((a, b) => a - b)
        .join(","),
      changed_by: userId,
    },
    { transaction: t }
  );
  return group;
};

const serializeTables = async (
  role?: UserRole,
  userId?: number
): Promise<TableRow[]> => {
  const count = await Table.count();
  if (count === 0) {
    await Table.bulkCreate(
      Array.from({ length: 30 }, (_, i) => ({
        number: i + 1,
        capacity: 4,
        is_active: true,
      }))
    );
  }

  const where = role === "admin" ? {} : { is_active: true };
  const tables = await Table.findAll({
    where,
    order: [["number", "ASC"]],
  });
  const members = await TableGroupMember.findAll({
    include: [{ model: Table, as: "table" }],
  });
  const numbersByGroup = new Map<number, number[]>();
  const groupByTable = new Map<number, number>();
  for (const member of members) {
    const table = member.get("table") as Table | undefined;
    const number = table?.number;
    if (!number) continue;
    groupByTable.set(member.table_id, member.group_id);
    const list = numbersByGroup.get(member.group_id) || [];
    list.push(number);
    numbersByGroup.set(member.group_id, list);
  }
  for (const [groupId, list] of numbersByGroup) {
    numbersByGroup.set(
      groupId,
      [...new Set(list)].sort((a, b) => a - b)
    );
  }
  const occupied = await occupiedTableIds();
  const groups = await TableGroup.findAll();
  const createdByGroup = new Map<number, number>();
  for (const group of groups) {
    createdByGroup.set(Number(group.id), Number(group.created_by));
  }

  return tables.map((table) => {
    const groupId = groupByTable.get(Number(table.id)) || null;
    const createdBy = groupId ? createdByGroup.get(groupId) || null : null;
    return {
      id: Number(table.id),
      number: Number(table.number),
      capacity: table.capacity == null ? null : Number(table.capacity),
      is_active: Boolean(table.is_active),
      group_id: groupId,
      group_numbers: groupId ? numbersByGroup.get(groupId) || [] : [],
      occupied: occupied.has(Number(table.id)),
      group_created_by: createdBy,
      can_ungroup: Boolean(
        groupId &&
          (role === "admin" || (userId != null && createdBy === userId))
      ),
    };
  });
};

export const listTablesController = async (
  role?: UserRole,
  userId?: number
): Promise<TableRow[]> => {
  return serializeTables(role, userId);
};

export const seedTablesController = async (
  count = 30
): Promise<TableRow[]> => {
  const existing = await Table.count();
  if (existing > 0) {
    return serializeTables("admin");
  }
  await Table.bulkCreate(
    Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      capacity: 4,
      is_active: true,
    }))
  );
  return serializeTables("admin");
};

export const setTableActiveController = async (
  tableId: number,
  isActive: unknown,
  reason: string,
  userId: number,
  role: UserRole
): Promise<TableRow | undefined> => {
  if (role !== "admin") {
    throw new AppError("Solo administración cambia la disponibilidad de mesas", 403);
  }
  const id = Number(tableId);
  if (typeof isActive !== "boolean") {
    throw new AppError("Indica si la mesa queda habilitada");
  }
  const next = isActive;
  const note = reason.trim();
  if (!id) throw new AppError("Mesa no válida", 404);
  if (!note) throw new AppError("Indica el motivo del cambio");

  await sequelize.transaction(async (t) => {
    const table = await Table.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!table) throw new AppError("Mesa no válida", 404);
    if (table.is_active === next) return;
    await assertFree([id], t);

    if (!next) {
      const member = await TableGroupMember.findOne({
        where: { table_id: id },
        transaction: t,
      });
      if (member) {
        const groupId = member.group_id;
        await member.destroy({ transaction: t });
        const left = await TableGroupMember.count({
          where: { group_id: groupId },
          transaction: t,
        });
        if (left < 2) {
          await TableGroupMember.destroy({
            where: { group_id: groupId },
            transaction: t,
          });
          await TableGroup.destroy({ where: { id: groupId }, transaction: t });
        }
      }
    }

    const previous = table.is_active;
    table.is_active = next;
    await table.save({ transaction: t });
    await TableStatusChange.create(
      {
        table_id: id,
        previous_is_active: previous,
        next_is_active: next,
        reason: note,
        changed_by: userId,
      },
      { transaction: t }
    );
  });

  const list = await serializeTables("admin");
  return list.find((item) => item.id === id);
};

export const groupTablesController = async (
  tableIds: number[],
  userId: number,
  role: UserRole
): Promise<TableRow[]> => {
  if (role !== "admin" && role !== "mesero") {
    throw new AppError("Solo el mesero o el administrador agrupa mesas", 403);
  }
  const unique = [...new Set(tableIds.map(Number).filter((id) => id > 0))];
  if (unique.length < 2) {
    throw new AppError("Elige al menos dos mesas para agrupar");
  }
  const already = await TableGroupMember.findAll({
    where: { table_id: { [Op.in]: unique } },
  });
  const groupIds = [...new Set(already.map((row) => row.group_id))];
  if (groupIds.length === 1 && already.length === unique.length) {
    throw new AppError("Esas mesas ya están agrupadas");
  }
  await sequelize.transaction(async (t) => {
    await mergeIntoGroup(tableIds, userId, role, t);
  });
  return serializeTables(role === "admin" ? "admin" : undefined, userId);
};

export const ungroupTablesController = async (
  groupId: number,
  userId: number,
  role: UserRole
): Promise<TableRow[]> => {
  if (role !== "admin" && role !== "mesero") {
    throw new AppError("No puedes separar mesas", 403);
  }
  const id = Number(groupId);
  if (!id) throw new AppError("Grupo no válido");

  await sequelize.transaction(async (t) => {
    const group = await TableGroup.findByPk(id, { transaction: t });
    if (!group) throw new AppError("Ese grupo no existe", 404);
    if (role !== "admin" && group.created_by !== userId) {
      throw new AppError(
        "Ese grupo lo armó administración. Solo puedes separar un grupo que tú formaste"
      );
    }
    const members = await TableGroupMember.findAll({
      where: { group_id: id },
      transaction: t,
    });
    if (!members.length) throw new AppError("Ese grupo no existe", 404);
    const tableIds = members.map((row) => row.table_id);
    await assertFree(tableIds, t);
    const numbered = await Table.findAll({
      where: { id: { [Op.in]: tableIds } },
      transaction: t,
    });
    await TableGroupMember.destroy({ where: { group_id: id }, transaction: t });
    await TableGroup.destroy({ where: { id }, transaction: t });
    await TableGroupChange.create(
      {
        group_id: id,
        action: "desagrupar",
        table_ids: numbered
          .map((table) => table.number)
          .sort((a, b) => a - b)
          .join(","),
        changed_by: userId,
      },
      { transaction: t }
    );
  });
  return serializeTables(role === "admin" ? "admin" : undefined, userId);
};

export const listTableChangesController = async (
  role: UserRole
): Promise<TableChangeRow[]> => {
  if (role !== "admin") {
    throw new AppError("Solo administración ve el historial de mesas", 403);
  }
  const [statusRows, groupRows] = await Promise.all([
    TableStatusChange.findAll({
      include: [
        { model: Table, as: "table", attributes: ["id", "number"] },
        { model: User, as: "changed_by_user", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 40,
    }),
    TableGroupChange.findAll({
      include: [
        { model: User, as: "changed_by_user", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 40,
    }),
  ]);

  const status = statusRows.map((row) => ({
    id: `s-${Number(row.id)}`,
    kind: "disponibilidad" as const,
    at: row.created_at ? new Date(row.created_at).toISOString() : null,
    table_number: (row.get("table") as Table | undefined)?.number
      ? Number((row.get("table") as Table).number)
      : null,
    detail: row.next_is_active ? "Habilitada" : "Inhabilitada",
    reason: row.reason,
    user_name: (row.get("changed_by_user") as User | undefined)?.name || "",
  }));
  const groups = groupRows.map((row) => ({
    id: `g-${Number(row.id)}`,
    kind: "agrupacion" as const,
    at: row.created_at ? new Date(row.created_at).toISOString() : null,
    table_number: null,
    detail:
      row.action === "agrupar"
        ? `Agrupó mesas ${row.table_ids}`
        : `Separó mesas ${row.table_ids}`,
    reason: "",
    user_name: (row.get("changed_by_user") as User | undefined)?.name || "",
  }));

  return [...status, ...groups]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 50);
};
