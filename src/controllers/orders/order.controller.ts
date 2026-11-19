import {
  Category,
  Dish,
  Ingredient,
  InventoryMovement,
  KitchenTicket,
  Order,
  OrderCancellation,
  OrderTable,
  OrderDetail,
  RecipeItem,
  Table,
  TableGroupMember,
  User,
} from "../../models";
import {
  mergeIntoGroup,
  tableIdsInSameGroup,
  ungroupTablesController,
} from "./tables.controller";
import { Op, fn, col, where as sqlWhere, type Transaction } from "sequelize";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";
import { publishLive, type LiveScope } from "../../live/hub";
import {
  isOffsiteModality,
  type AttentionModality,
  type KitchenStatus,
  type UserRole,
} from "../../types/enums";

type DetailInput = {
  dish_id?: number;
  quantity?: number;
  observation?: string;
};

type OpenOrderInput = {
  table_id?: number;
  modality?: string;
  delivery_customer_name?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_note?: string;
};

const limaYmd = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(date);

const limaDateStamp = (date = new Date()) => {
  const [year, month, day] = limaYmd(date).split("-");
  return `${day}${month}${year.slice(2)}`;
};

const parseDay = (value?: string) => {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError("La fecha debe tener el formato AAAA-MM-DD", 400);
  }
  const start = new Date(`${raw}T00:00:00-05:00`);
  if (Number.isNaN(start.getTime())) throw new AppError("Fecha no válida", 400);
  return raw;
};

const dayBounds = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00-05:00`);
  const end = new Date(`${to}T23:59:59.999-05:00`);
  if (start > end) {
    throw new AppError("La fecha inicial no puede ser mayor que la final", 400);
  }
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new AppError("El rango no puede superar un año", 400);
  }
  return { start, end };
};

const nextNumberedCode = async (prefix: string, t: Transaction) => {
  const rows = await Order.findAll({
    where: { code: { [Op.like]: `${prefix}%` } },
    attributes: ["code"],
    transaction: t,
  });
  let max = 0;
  for (const row of rows) {
    const value = Number(String(row.code).slice(prefix.length));
    if (Number.isFinite(value) && value > max) max = value;
  }
  for (let step = 1; step <= 50; step++) {
    const code = `${prefix}${String(max + step).padStart(2, "0")}`;
    const taken = await Order.findOne({ where: { code }, transaction: t });
    if (!taken) return code;
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
};

const tableCodePart = (tableNumbers: number[]) => {
  const unique = [...new Set(tableNumbers.filter((n) => n > 0))].sort(
    (a, b) => a - b
  );
  if (!unique.length) return "00";
  return unique.map((n) => String(n).padStart(2, "0")).join("+");
};

// Ej: MES-04-191126-01, DEL-191126-01, LLE-191126-01
const generateTableOrderCode = async (
  tableNumbers: number | number[],
  t: Transaction
) => {
  const list = Array.isArray(tableNumbers) ? tableNumbers : [tableNumbers];
  return nextNumberedCode(
    `MES-${tableCodePart(list.map(Number))}-${limaDateStamp()}-`,
    t
  );
};

const generateOffsiteOrderCode = async (
  modality: "delivery" | "para_llevar",
  t: Transaction
) => {
  const kind = modality === "para_llevar" ? "LLE" : "DEL";
  return nextNumberedCode(`${kind}-${limaDateStamp()}-`, t);
};

// Trae el pedido con mesa, mesero, platos y comanda
const tablesInclude = {
  model: Table,
  as: "tables",
  through: { attributes: [] },
};

const loadOrder = async (orderId: number) => {
  const order = await Order.findByPk(orderId, {
    include: [
      { model: Table, as: "table" },
      tablesInclude,
      { model: User, as: "waiter", attributes: ["id", "name", "email", "role"] },
      {
        model: User,
        as: "cancelled_by_user",
        attributes: ["id", "name", "role"],
      },
      {
        model: OrderDetail,
        as: "details",
        include: [{ model: Dish, as: "dish" }],
      },
      { model: KitchenTicket, as: "kitchen_ticket" },
      {
        model: OrderCancellation,
        as: "cancellation",
        include: [
          {
            model: User,
            as: "cancelled_by_user",
            attributes: ["id", "name", "role"],
          },
        ],
      },
      {
        model: InventoryMovement,
        as: "inventory_movements",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: Ingredient,
            as: "ingredient",
            attributes: ["id", "name", "unit"],
          },
        ],
      },
    ],
  });
  if (!order) throw new AppError("Pedido no encontrado", 404);
  return order;
};

const finishOrder = async (orderId: number, extra: LiveScope[] = []) => {
  publishLive("orders", ...extra);
  return loadOrder(orderId);
};

const OPEN_STATUSES = ["en_edicion", "confirmado"] as const;

const findOpenOrderByTable = async (tableId: number, t: Transaction) => {
  const viaLink = await OrderTable.findOne({
    where: { table_id: tableId },
    include: [
      {
        model: Order,
        as: "order",
        required: true,
        where: { status: { [Op.in]: [...OPEN_STATUSES] } },
      },
    ],
    transaction: t,
  });
  if (viaLink) return viaLink.get("order") as Order;
  return Order.findOne({
    where: {
      table_id: tableId,
      status: { [Op.in]: [...OPEN_STATUSES] },
    },
    transaction: t,
  });
};

const linkTableToOrder = async (
  orderId: number,
  tableId: number,
  t: Transaction
) => {
  const existing = await OrderTable.findOne({
    where: { order_id: orderId, table_id: tableId },
    transaction: t,
  });
  if (!existing) {
    await OrderTable.create(
      { order_id: orderId, table_id: tableId },
      { transaction: t }
    );
  }
};

const linkedTables = async (orderId: number, t: Transaction) => {
  const links = await OrderTable.findAll({
    where: { order_id: orderId },
    include: [{ model: Table, as: "table" }],
    transaction: t,
  });
  return links
    .map((link) => link.get("table") as Table | undefined)
    .filter((table): table is Table => Boolean(table))
    .sort((a, b) => a.number - b.number);
};

const refreshHostTable = async (order: Order, t: Transaction) => {
  const tables = await linkedTables(order.id, t);
  const host = tables[0];
  if (host && order.table_id !== host.id) {
    order.table_id = host.id;
    await order.save({ transaction: t });
  }
  return tables;
};

const lineCharge = (detail: OrderDetail) => {
  if (detail.charged === false) return 0;
  return Number(detail.unit_price) * Number(detail.quantity);
};

const recalcOrderTotal = async (order: Order, t: Transaction) => {
  const details = await OrderDetail.findAll({
    where: { order_id: order.id },
    transaction: t,
  });
  order.total = details.reduce((sum, detail) => sum + lineCharge(detail), 0);
  if (Number(order.amount_paid || 0) > Number(order.total)) {
    order.amount_paid = Number(order.total);
  }
  syncPaidFlag(order);
  await order.save({ transaction: t });
};

// Suma cuánto ingrediente pide cada plato del pedido
const assertCanEditItems = (order: Order) => {
  if (order.status === "en_edicion" || order.status === "confirmado") return;
  throw new AppError("Este pedido ya no se puede modificar");
};

const dueAmount = (order: Order) =>
  Math.max(0, Number(order.total) - Number(order.amount_paid || 0));

const syncPaidFlag = (order: Order) => {
  const settled = dueAmount(order) <= 0.009;
  order.paid = settled;
  if (!settled) {
    order.paid_at = null;
  }
};

const calcRequiredStock = async (
  orderId: number,
  options: { unsentOnly?: boolean } = {}
) => {
  const details = await OrderDetail.findAll({
    where: {
      order_id: orderId,
      ...(options.unsentOnly ? { sent_to_kitchen: false } : {}),
    },
    include: [
      {
        model: Dish,
        as: "dish",
        include: [
          {
            model: RecipeItem,
            as: "recipe_items",
            include: [{ model: Ingredient, as: "ingredient" }],
          },
        ],
      },
    ],
  });

  const required = requiredFromDetails(details);
  return { details, required };
};

const requiredFromDetails = (details: OrderDetail[]) => {
  const required = new Map<
    number,
    { ingredient: Ingredient; needed: number; dishes: string[] }
  >();

  for (const detail of details) {
    const dish = detail.get("dish") as
      | (Dish & {
          recipe_items?: (RecipeItem & { ingredient?: Ingredient })[];
        })
      | undefined;
    const recipeItems = dish?.recipe_items || [];
    if (!dish || recipeItems.length === 0) {
      continue;
    }

    for (const item of recipeItems) {
      const ingredient = item.ingredient;
      if (!ingredient) continue;
      const neededQty = Number(item.quantity) * Number(detail.quantity);
      const current = required.get(ingredient.id);
      if (current) {
        current.needed += neededQty;
        if (!current.dishes.includes(dish.name)) {
          current.dishes.push(dish.name);
        }
      } else {
        required.set(ingredient.id, {
          ingredient,
          needed: neededQty,
          dishes: [dish.name],
        });
      }
    }
  }

  return required;
};

const applyCancelStock = async (
  required: Map<
    number,
    { ingredient: Ingredient; needed: number; dishes: string[] }
  >,
  options: {
    kitchenStatus: KitchenStatus | null;
    orderId: number;
    userId: number;
    reason: string;
    t: Transaction;
  }
) => {
  const { kitchenStatus, orderId, userId, reason, t } = options;
  if (!kitchenStatus || kitchenStatus === "entregado") return "none";

  for (const [, item] of required) {
    if (item.needed <= 0) continue;
    await InventoryMovement.create(
      {
        ingredient_id: item.ingredient.id,
        type: "merma",
        quantity: Number(item.needed),
        reason: `Merma por cancelación: ${reason}`,
        order_id: orderId,
        user_id: userId,
        merma_review: "pendiente",
      },
      { transaction: t }
    );
  }
  return "merma";
};

const consumeRequired = async (
  order: Order,
  required: Map<
    number,
    { ingredient: Ingredient; needed: number; dishes: string[] }
  >,
  t: Transaction
) => {
  for (const [, item] of required) {
    const ingredient = await Ingredient.findByPk(item.ingredient.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!ingredient) {
      throw new AppError(`Ingrediente ${item.ingredient.id} no encontrado`);
    }
    const available = Number(ingredient.stock_current);
    if (available < item.needed) {
      throw new AppError(
        `Stock insuficiente de ${ingredient.name}. Afecta: ${item.dishes.join(", ")}`
      );
    }
  }

  for (const [, item] of required) {
    const ingredient = await Ingredient.findByPk(item.ingredient.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!ingredient) continue;
    const nextStock = Number(ingredient.stock_current) - item.needed;
    if (nextStock < 0) {
      throw new AppError(`El stock de ${ingredient.name} no puede quedar negativo`);
    }
    ingredient.stock_current = nextStock;
    await ingredient.save({ transaction: t });
    await InventoryMovement.create(
      {
        ingredient_id: ingredient.id,
        type: "salida_venta",
        quantity: item.needed,
        reason: `Consumo pedido ${order.code}`,
        order_id: order.id,
        user_id: order.waiter_id,
      },
      { transaction: t }
    );
  }
};

const resolveOpenModality = (data: OpenOrderInput): AttentionModality => {
  if (isOffsiteModality(data.modality)) {
    return data.modality as AttentionModality;
  }
  const hasCustomer = Boolean(data.delivery_customer_name?.trim());
  const hasTable = Boolean(Number(data.table_id));
  if (hasCustomer && !hasTable) {
    return data.delivery_address?.trim() ? "delivery" : "para_llevar";
  }
  return "mesa";
};

export const openOrderController = async (
  data: OpenOrderInput,
  userId: number,
  role: UserRole
) => {
  const modality = resolveOpenModality(data);

  if (isOffsiteModality(modality)) {
    if (role !== "admin" && role !== "cajero") {
      throw new AppError(
        "Solo administración o caja abre un pedido para llevar o delivery",
        403
      );
    }
    const name = data.delivery_customer_name?.trim() || "";
    const phone = data.delivery_phone?.trim() || "";
    const address = data.delivery_address?.trim() || "";
    if (!name) throw new AppError("El nombre del cliente es obligatorio");
    if (modality === "delivery") {
      if (!phone) throw new AppError("El teléfono es obligatorio");
      if (!address) throw new AppError("La dirección es obligatoria");
    }

    const orderId = await sequelize.transaction(async (t) => {
      const order = await Order.create(
        {
          code: await generateOffsiteOrderCode(modality, t),
          modality,
          table_id: null,
          waiter_id: userId,
          delivery_customer_name: name,
          delivery_phone: phone || null,
          delivery_address: modality === "delivery" ? address : null,
          delivery_note: data.delivery_note?.trim() || null,
          status: "en_edicion",
          total: 0,
        },
        { transaction: t }
      );
      return order.id;
    });
    return finishOrder(orderId);
  }

  if (role !== "admin" && role !== "mesero") {
    throw new AppError("Solo el mesero o el administrador abre un pedido de mesa", 403);
  }

  const tableId = Number(data.table_id);
  if (!tableId) throw new AppError("Debe seleccionar una mesa");

  const orderId = await sequelize.transaction(async (t) => {
    const table = await Table.findByPk(tableId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!table || !table.is_active) {
      throw new AppError("Mesa no válida", 404);
    }

    const groupIds = await tableIdsInSameGroup(tableId, t);
    for (const id of groupIds) {
      const open = await findOpenOrderByTable(id, t);
      if (open) {
        throw new AppError("La mesa sigue ocupada");
      }
    }

    const groupedTables = await Table.findAll({
      where: { id: { [Op.in]: groupIds.length ? groupIds : [tableId] } },
      attributes: ["number"],
      transaction: t,
    });

    const order = await Order.create(
      {
        code: await generateTableOrderCode(
          groupedTables.map((row) => row.number),
          t
        ),
        modality: "mesa",
        table_id: tableId,
        waiter_id: userId,
        status: "en_edicion",
        total: 0,
      },
      { transaction: t }
    );
    for (const id of groupIds) {
      await linkTableToOrder(order.id, id, t);
    }
    return order.id;
  });

  return finishOrder(orderId, ["tables"]);
};

export const joinTablesController = async (
  fromTableId: number,
  toTableId: number,
  userId: number,
  role: UserRole
) => {
  if (role !== "admin" && role !== "mesero") {
    throw new AppError("Solo el mesero o el administrador une mesas", 403);
  }
  const fromId = Number(fromTableId);
  const toId = Number(toTableId);
  if (!fromId || !toId) throw new AppError("Elige dos mesas para unirlas");
  if (fromId === toId) throw new AppError("Arrastra una mesa sobre otra distinta");

  const orderId = await sequelize.transaction(async (t) => {
    const firstId = Math.min(fromId, toId);
    const secondId = Math.max(fromId, toId);
    const first = await Table.findByPk(firstId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const second = await Table.findByPk(secondId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!first?.is_active || !second?.is_active) {
      throw new AppError("Mesa no válida", 404);
    }

    const fromOrder = await findOpenOrderByTable(fromId, t);
    const toOrder = await findOpenOrderByTable(toId, t);
    if (fromOrder || toOrder) {
      throw new AppError(
        "Hay un pedido abierto en esa mesa. Ciérralo o libéralo antes de agrupar"
      );
    }

    await mergeIntoGroup([fromId, toId], userId, role, t);
    const memberIds = await tableIdsInSameGroup(fromId, t);
    const host =
      first.number <= second.number ? first : second;
    const groupedTables = await Table.findAll({
      where: {
        id: { [Op.in]: memberIds.length ? memberIds : [fromId, toId] },
      },
      attributes: ["number"],
      transaction: t,
    });
    const order = await Order.create(
      {
        code: await generateTableOrderCode(
          groupedTables.map((row) => row.number),
          t
        ),
        modality: "mesa",
        table_id: host.id,
        waiter_id: userId,
        status: "en_edicion",
        total: 0,
      },
      { transaction: t }
    );
    for (const id of memberIds.length ? memberIds : [fromId, toId]) {
      await linkTableToOrder(order.id, id, t);
    }
    return order.id;
  });

  return finishOrder(orderId, ["tables"]);
};

export const splitTableController = async (
  tableId: number,
  userId: number,
  role: UserRole
): Promise<
  Awaited<ReturnType<typeof ungroupTablesController>>
> => {
  const member = await TableGroupMember.findOne({
    where: { table_id: Number(tableId) },
  });
  if (!member) throw new AppError("Esa mesa no está agrupada");
  return ungroupTablesController(member.group_id, userId, role);
};

export const listOrdersController = async (
  modality?: string,
  role?: UserRole
) => {
  const where: Record<string, unknown> = {};
  if (modality === "offsite") {
    where.modality = { [Op.in]: ["delivery", "para_llevar"] };
  } else if (
    modality === "mesa" ||
    modality === "delivery" ||
    modality === "para_llevar"
  ) {
    where.modality = modality;
  } else if (role === "cajero") {
    where.modality = { [Op.in]: ["delivery", "para_llevar"] };
  }

  return Order.findAll({
    where,
    include: [
      { model: Table, as: "table" },
      tablesInclude,
      { model: User, as: "waiter", attributes: ["id", "name", "role"] },
      {
        model: OrderDetail,
        as: "details",
        include: [{ model: Dish, as: "dish" }],
      },
      { model: KitchenTicket, as: "kitchen_ticket" },
    ],
    order: [["created_at", "DESC"]],
  });
};

type OrderHistoryQuery = {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  modality?: string;
};

const HISTORY_STATUSES = [
  "en_edicion",
  "confirmado",
  "cerrado",
  "cancelado",
] as const;

export const listOrdersHistoryController = async (query: OrderHistoryQuery) => {
  const today = limaYmd();
  const single = parseDay(query.date);
  const from = single || parseDay(query.from) || today;
  const to = single || parseDay(query.to) || today;
  const { start, end } = dayBounds(from, to);

  const where: Record<string, unknown> = {
    [Op.and]: [
      sqlWhere(
        fn("COALESCE", col("Order.confirmed_at"), col("Order.created_at")),
        { [Op.between]: [start, end] }
      ),
    ],
  };

  const status = (query.status || "").trim();
  if (status === "pendientes") {
    where.status = { [Op.in]: ["en_edicion", "confirmado"] };
  } else if (status === "completados") {
    where.status = "cerrado";
  } else if (
    HISTORY_STATUSES.includes(status as (typeof HISTORY_STATUSES)[number])
  ) {
    where.status = status;
  }

  const modality = (query.modality || "").trim();
  if (modality === "offsite") {
    where.modality = { [Op.in]: ["delivery", "para_llevar"] };
  } else if (
    modality === "mesa" ||
    modality === "delivery" ||
    modality === "para_llevar"
  ) {
    where.modality = modality;
  }

  const orders = await Order.findAll({
    where,
    include: [
      { model: Table, as: "table" },
      tablesInclude,
      { model: User, as: "waiter", attributes: ["id", "name", "role"] },
      {
        model: OrderDetail,
        as: "details",
        include: [{ model: Dish, as: "dish" }],
      },
      { model: KitchenTicket, as: "kitchen_ticket" },
    ],
    order: [
      [
        fn("COALESCE", col("Order.confirmed_at"), col("Order.created_at")),
        "DESC",
      ],
    ],
  });

  const by_status = Object.fromEntries(
    HISTORY_STATUSES.map((key) => [key, { count: 0, total: 0 }])
  ) as Record<
    (typeof HISTORY_STATUSES)[number],
    { count: number; total: number }
  >;

  for (const order of orders) {
    const amount = Number(order.total) || 0;
    const key = order.status as (typeof HISTORY_STATUSES)[number];
    if (!by_status[key]) continue;
    by_status[key].count += 1;
    by_status[key].total += amount;
  }

  return {
    from,
    to,
    orders,
    summary: {
      count: orders.length,
      sales_total: by_status.confirmado.total + by_status.cerrado.total,
      pending_total: by_status.en_edicion.total,
      cancelled_total: by_status.cancelado.total,
      by_status,
    },
  };
};

type SoldDishRow = {
  id: number;
  dish_id: number;
  dish_name: string;
  presentation: string;
  quantity: number;
  unit_price: number;
  total: number;
  order_id: number;
  order_code: string;
  modality: AttentionModality;
  table_number: number | null;
  sold_at: string | null;
};

export const listSoldDishesController = async (): Promise<SoldDishRow[]> => {
  const details = await OrderDetail.findAll({
    where: { charged: true },
    include: [
      {
        model: Order,
        as: "order",
        required: true,
        where: { status: { [Op.in]: ["confirmado", "cerrado"] } },
        include: [{ model: Table, as: "table", required: false }],
      },
      {
        model: Dish,
        as: "dish",
        required: false,
        attributes: ["id", "name", "presentation"],
      },
    ],
    order: [["id", "DESC"]],
  });

  return details.map((detail) => {
    const order = (detail.get("order") as Order | undefined) || undefined;
    const dish = detail.get("dish") as Dish | undefined;
    const table = order
      ? ((order.get("table") as Table | undefined) ?? undefined)
      : undefined;
    const soldAt = order?.confirmed_at || order?.created_at || null;
    return {
      id: Number(detail.id),
      dish_id: Number(detail.dish_id),
      dish_name: dish?.name || `Plato ${detail.dish_id}`,
      presentation: dish?.presentation || "",
      quantity: Number(detail.quantity),
      unit_price: Number(detail.unit_price),
      total: Number(detail.unit_price) * Number(detail.quantity),
      order_id: Number(order?.id || detail.order_id),
      order_code: order?.code || "",
      modality: order?.modality || "mesa",
      table_number: table?.number ?? null,
      sold_at: soldAt ? new Date(soldAt).toISOString() : null,
    };
  });
};

export const getOrderController = async (orderId: number) => {
  return loadOrder(orderId);
};

export const addOrderDetailController = async (
  orderId: number,
  data: DetailInput
) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  assertCanEditItems(order);

  const dishId = Number(data.dish_id);
  const quantity = Number(data.quantity);
  if (!dishId) throw new AppError("Debe seleccionar un plato");
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError("La cantidad debe ser un entero mayor que cero");
  }

  const dish = await Dish.findByPk(dishId, {
    include: [{ model: Category, as: "category" }],
  });
  const category = (dish as Dish & { category?: Category | null })?.category;
  if (!dish || !dish.is_active || !category?.is_active) {
    throw new AppError("El plato no está disponible");
  }

  await OrderDetail.create({
    order_id: orderId,
    dish_id: dishId,
    quantity,
    unit_price: Number(dish.price),
    observation: data.observation?.trim() || null,
    sent_to_kitchen: false,
  });

  const details = await OrderDetail.findAll({ where: { order_id: orderId } });
  // Recalcula el total cada vez que cambia un plato
  order.total = details.reduce(
    (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
    0
  );
  syncPaidFlag(order);
  await order.save();

  return finishOrder(orderId);
};

export const removeOrderDetailController = async (
  orderId: number,
  detailId: number
) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  assertCanEditItems(order);

  const detail = await OrderDetail.findOne({
    where: { id: detailId, order_id: orderId },
  });
  if (!detail) throw new AppError("Detalle no encontrado", 404);
  if (order.status === "confirmado" && detail.sent_to_kitchen) {
    throw new AppError("Ese plato ya fue enviado a cocina");
  }
  await detail.destroy();

  const details = await OrderDetail.findAll({ where: { order_id: orderId } });
  order.total = details.reduce(
    (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
    0
  );
  syncPaidFlag(order);
  await order.save();

  return finishOrder(orderId);
};

export const updateOrderDetailController = async (
  orderId: number,
  detailId: number,
  data: DetailInput
) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  assertCanEditItems(order);

  const detail = await OrderDetail.findOne({
    where: { id: detailId, order_id: orderId },
  });
  if (!detail) throw new AppError("Detalle no encontrado", 404);
  if (
    order.status === "confirmado" &&
    detail.sent_to_kitchen &&
    data.quantity !== undefined
  ) {
    throw new AppError("Ese plato ya fue enviado a cocina");
  }

  if (data.quantity !== undefined) {
    const quantity = Number(data.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new AppError("La cantidad debe ser un entero válido");
    }
    if (quantity === 0) {
      await detail.destroy();
      const remaining = await OrderDetail.findAll({
        where: { order_id: orderId },
      });
      order.total = remaining.reduce(
        (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
        0
      );
      syncPaidFlag(order);
      await order.save();
      return finishOrder(orderId);
    }
    detail.quantity = quantity;
  }

  if (data.observation !== undefined) {
    detail.observation = data.observation.trim() || null;
  }

  await detail.save();

  const details = await OrderDetail.findAll({ where: { order_id: orderId } });
  order.total = details.reduce(
    (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
    0
  );
  syncPaidFlag(order);
  await order.save();
  return finishOrder(orderId);
};

export const validateStockController = async (orderId: number) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "en_edicion" && order.status !== "confirmado") {
    throw new AppError("El pedido no admite validación de stock");
  }

  const { details, required } = await calcRequiredStock(orderId, {
    unsentOnly: order.status === "confirmado",
  });
  if (details.length === 0) {
    throw new AppError("El pedido debe contener al menos un plato");
  }

  const shortages: Array<{
    ingredient_id: number;
    name: string;
    needed: number;
    available: number;
    dishes: string[];
  }> = [];

  for (const [, item] of required) {
    const available = Number(item.ingredient.stock_current);
    if (available < item.needed) {
      shortages.push({
        ingredient_id: item.ingredient.id,
        name: item.ingredient.name,
        needed: item.needed,
        available,
        dishes: item.dishes,
      });
    }
  }

  return {
    ok: shortages.length === 0,
    shortages,
  };
};

export const confirmOrderController = async (orderId: number) => {
  // Todo o nada: stock, estado del pedido y comanda se guardan juntos
  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status !== "en_edicion") {
      throw new AppError("El pedido ya fue confirmado o cancelado");
    }

    const details = await OrderDetail.findAll({
      where: { order_id: orderId },
      transaction: t,
    });
    if (details.length === 0) {
      throw new AppError("El pedido debe contener al menos un plato");
    }

    const { required } = await calcRequiredStock(orderId);
    await consumeRequired(order, required, t);

    const expectedTotal = details.reduce(
      (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
      0
    );
    order.total = expectedTotal;
    order.status = "confirmado";
    order.confirmed_at = new Date();
    order.amount_paid = 0;
    order.paid = false;
    order.paid_at = null;
    await order.save({ transaction: t });

    const existingTicket = await KitchenTicket.findOne({
      where: { order_id: orderId },
      transaction: t,
    });
    if (existingTicket) {
      throw new AppError("El pedido ya tiene una comanda");
    }

    await KitchenTicket.create(
      {
        order_id: orderId,
        status: "pendiente",
        status_changed_at: new Date(),
      },
      { transaction: t }
    );

    for (const detail of details) {
      detail.sent_to_kitchen = true;
      detail.kitchen_status = "pendiente";
      await detail.save({ transaction: t });
    }
  });

  return finishOrder(orderId, ["kitchen", "inventory"]);
};

export const sendAdditionsController = async (orderId: number) => {
  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status !== "confirmado") {
      throw new AppError("Solo se envían adicionales de un pedido confirmado");
    }

    const pending = await OrderDetail.findAll({
      where: { order_id: orderId, sent_to_kitchen: false },
      transaction: t,
    });
    if (!pending.length) {
      throw new AppError("No hay platos nuevos para enviar a cocina");
    }

    const { required } = await calcRequiredStock(orderId, { unsentOnly: true });
    await consumeRequired(order, required, t);

    for (const detail of pending) {
      detail.sent_to_kitchen = true;
      detail.kitchen_status = "pendiente";
      await detail.save({ transaction: t });
    }

    const ticket = await KitchenTicket.findOne({
      where: { order_id: orderId },
      transaction: t,
    });
    if (ticket) {
      ticket.status = "pendiente";
      ticket.status_changed_at = new Date();
      await ticket.save({ transaction: t });
    }

    syncPaidFlag(order);
    await order.save({ transaction: t });
  });

  return finishOrder(orderId, ["kitchen", "inventory"]);
};

export const setOrderPaidController = async (orderId: number, paid: boolean) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "confirmado") {
    throw new AppError("Solo se registra el pago de un pedido confirmado");
  }
  if (paid) {
    order.amount_paid = Number(order.total);
    order.paid = true;
    order.paid_at = new Date();
  } else {
    order.amount_paid = 0;
    order.paid = false;
    order.paid_at = null;
  }
  await order.save();
  return finishOrder(orderId, ["tables"]);
};

export const cancelOrderController = async (
  orderId: number,
  reason: string,
  userId: number
) => {
  const cancelReason = reason?.trim();
  if (!cancelReason) throw new AppError("La cancelación exige un motivo");
  if (cancelReason.length < 3) {
    throw new AppError("El motivo debe tener al menos 3 caracteres");
  }

  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status === "cancelado") {
      throw new AppError("El pedido ya está cancelado");
    }
    if (order.status === "cerrado") {
      throw new AppError("El pedido ya está cerrado y la mesa fue liberada");
    }

    const ticket = await KitchenTicket.findOne({
      where: { order_id: orderId },
      transaction: t,
    });
    const kitchenStatus = (ticket?.status || null) as KitchenStatus | null;
    if (kitchenStatus === "entregado") {
      throw new AppError(
        "No se puede cancelar: la comanda ya salió a mesa. Si un plato salió mal, regístralo en el plato"
      );
    }

    let stockAction: string = "none";
    if (order.status === "confirmado") {
      const remaining = await OrderDetail.findAll({
        where: {
          order_id: orderId,
          sent_to_kitchen: true,
          return_kind: null,
        },
        include: [
          {
            model: Dish,
            as: "dish",
            include: [
              {
                model: RecipeItem,
                as: "recipe_items",
                include: [{ model: Ingredient, as: "ingredient" }],
              },
            ],
          },
        ],
        transaction: t,
      });
      stockAction = await applyCancelStock(requiredFromDetails(remaining), {
        kitchenStatus,
        orderId,
        userId,
        reason: cancelReason,
        t,
      });
    }

    const previousStatus = order.status;
    order.status = "cancelado";
    order.cancel_reason = cancelReason;
    order.cancelled_at = new Date();
    order.cancelled_by = userId;
    await order.save({ transaction: t });

    await OrderCancellation.create(
      {
        order_id: orderId,
        previous_status: previousStatus,
        previous_kitchen_status: kitchenStatus,
        stock_action: stockAction,
        reason: cancelReason,
        cancelled_by: userId,
      },
      { transaction: t }
    );
  });

  return finishOrder(orderId, ["kitchen", "inventory", "tables"]);
};

export const returnOrderDetailController = async (
  orderId: number,
  detailId: number,
  data: { kind?: string; note?: string },
  userId: number
) => {
  const kind = data.kind === "defecto" ? "defecto" : data.kind === "no_le_gusto" ? "no_le_gusto" : "";
  if (!kind) {
    throw new AppError("Indica si no le gustó o si salió con defecto");
  }
  const note = data.note?.trim() || null;

  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status !== "confirmado") {
      throw new AppError("Solo se registra la devolución en un pedido abierto");
    }

    const detail = await OrderDetail.findOne({
      where: { id: detailId, order_id: orderId },
      include: [
        {
          model: Dish,
          as: "dish",
          include: [
            {
              model: RecipeItem,
              as: "recipe_items",
              include: [{ model: Ingredient, as: "ingredient" }],
            },
          ],
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!detail) throw new AppError("Plato no encontrado", 404);
    if (!detail.sent_to_kitchen) {
      throw new AppError("Ese plato todavía no fue a cocina; quítalo del ticket");
    }
    if (detail.return_kind) {
      throw new AppError("Ese plato ya tiene una devolución registrada");
    }

    const dish = detail.get("dish") as Dish | undefined;
    const dishName = dish?.name || `Plato ${detail.dish_id}`;
    const reason =
      kind === "defecto"
        ? `Defecto de ${dishName}${note ? `: ${note}` : ""}`
        : `No le gustó ${dishName}${note ? `: ${note}` : ""}`;

    const required = requiredFromDetails([detail]);
    for (const [, item] of required) {
      await InventoryMovement.create(
        {
          ingredient_id: item.ingredient.id,
          type: "merma",
          quantity: Number(item.needed),
          reason,
          order_id: orderId,
          user_id: userId,
          merma_review: "pendiente",
        },
        { transaction: t }
      );
    }

    detail.return_kind = kind;
    detail.return_note = note;
    detail.returned_at = new Date();
    detail.returned_by = userId;
    detail.charged = kind !== "defecto";
    await detail.save({ transaction: t });
    await recalcOrderTotal(order, t);
  });

  return finishOrder(orderId, ["kitchen", "inventory"]);
};

export const closeOrderController = async (orderId: number) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "confirmado") {
    throw new AppError(
      isOffsiteModality(order.modality)
        ? "Solo se cierra un pedido confirmado"
        : "Solo se libera una mesa con pedido confirmado"
    );
  }
  const pending = await OrderDetail.count({
    where: { order_id: orderId, sent_to_kitchen: false },
  });
  if (pending > 0) {
    throw new AppError("Hay platos nuevos sin enviar a cocina");
  }
  if (dueAmount(order) > 0.009) {
    throw new AppError(
      isOffsiteModality(order.modality)
        ? "El pedido tiene un saldo pendiente"
        : "La mesa tiene un saldo pendiente"
    );
  }
  order.status = "cerrado";
  order.closed_at = new Date();
  await order.save();
  return finishOrder(orderId, ["tables", "kitchen"]);
};
