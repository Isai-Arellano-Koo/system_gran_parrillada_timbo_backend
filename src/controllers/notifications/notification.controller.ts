import { UniqueConstraintError } from "sequelize";
import {
  Dish,
  KitchenTicket,
  Order,
  OrderDetail,
  Table,
  WaiterNotification,
} from "../../models";
import { AppError } from "../../middlewares/errorHandler";
import { publishLive } from "../../live/hub";
import type { UserRole } from "../../types/enums";

export type WaiterNotificationRow = {
  id: number;
  order_id: number;
  kitchen_ticket_id: number;
  order_detail_id: number | null;
  waiter_id: number;
  order_code: string;
  table_label: string;
  dish_label: string;
  modality: "mesa" | "delivery" | "para_llevar" | null;
  generated_at: string;
  attended_at: string | null;
};

export type WaiterNotificationList = {
  pending: WaiterNotificationRow[];
  history: WaiterNotificationRow[];
  pending_count: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

const tableLabelFromOrder = (order: Order) => {
  const linked = (order.get("tables") as Table[] | undefined) || [];
  const numbers = linked
    .map((table) => Number(table.number))
    .filter((value) => Number.isFinite(value) && value > 0);
  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  if (unique.length) {
    const text = unique.map(pad).join(" + ");
    return unique.length === 1 ? `Mesa ${text}` : `Mesas ${text}`;
  }
  const fallback = Number(
    (order.get("table") as Table | undefined)?.number || 0
  );
  if (fallback > 0) return `Mesa ${pad(fallback)}`;
  if (order.modality === "delivery") return "Delivery";
  if (order.modality === "para_llevar") return "Para llevar";
  return "Mesa";
};

const dishLabelOf = (dish?: Dish | null, observation?: string | null) => {
  const name = dish?.name || "Plato";
  const presentation = (dish?.presentation || "").trim();
  const base = presentation ? `${name} — ${presentation}` : name;
  const note = (observation || "").trim();
  return note ? `${base} (${note})` : base;
};

const orderInclude = {
  model: Order,
  as: "order" as const,
  attributes: ["id", "modality"],
};

const modalityOf = (
  row: WaiterNotification,
  fallback?: string | null
): WaiterNotificationRow["modality"] => {
  const order = row.get("order") as Order | undefined;
  const value = order?.modality || fallback || "";
  if (value === "delivery" || value === "para_llevar" || value === "mesa") {
    return value;
  }
  return null;
};

const serialize = (
  row: WaiterNotification,
  fallbackModality?: string | null
): WaiterNotificationRow => ({
  id: Number(row.id),
  order_id: Number(row.order_id),
  kitchen_ticket_id: Number(row.kitchen_ticket_id),
  order_detail_id: row.order_detail_id ? Number(row.order_detail_id) : null,
  waiter_id: Number(row.waiter_id),
  order_code: row.order_code,
  table_label: row.table_label,
  dish_label: row.dish_label || "Plato",
  modality: modalityOf(row, fallbackModality),
  generated_at: row.created_at
    ? new Date(row.created_at).toISOString()
    : new Date(row.ticket_ready_at).toISOString(),
  attended_at: row.attended_at ? new Date(row.attended_at).toISOString() : null,
});

export const notifyWaiterDishReady = async (
  detailId: number
): Promise<WaiterNotificationRow | null> => {
  const detail = await OrderDetail.findByPk(detailId, {
    include: [
      { model: Dish, as: "dish" },
      {
        model: Order,
        as: "order",
        include: [
          { model: Table, as: "table" },
          { model: Table, as: "tables", through: { attributes: [] } },
          { model: KitchenTicket, as: "kitchen_ticket" },
        ],
      },
    ],
  });
  if (!detail || detail.kitchen_status !== "listo") return null;
  const order = detail.get("order") as Order | undefined;
  if (!order) return null;
  const ticket = order.get("kitchen_ticket") as KitchenTicket | undefined;
  if (!ticket) return null;
  const dish = detail.get("dish") as Dish | undefined;

  try {
    const created = await WaiterNotification.create({
      kitchen_ticket_id: ticket.id,
      order_id: order.id,
      order_detail_id: detail.id,
      waiter_id: order.waiter_id,
      order_code: order.code,
      table_label: tableLabelFromOrder(order),
      dish_label: dishLabelOf(dish, detail.observation),
      ticket_ready_at: new Date(),
      attended_at: null,
    });
    publishLive("notifications");
    return serialize(created, order.modality);
  } catch (error) {
    if (error instanceof UniqueConstraintError) return null;
    throw error;
  }
};

export const listWaiterNotificationsController = async (
  userId: number,
  role: UserRole
): Promise<WaiterNotificationList> => {
  if (role !== "mesero" && role !== "admin") {
    throw new AppError("Solo el mesero consulta estas notificaciones", 403);
  }
  const rows = await WaiterNotification.findAll({
    where: { waiter_id: userId },
    include: [orderInclude],
    order: [["created_at", "DESC"]],
    limit: 80,
  });
  const pending = rows
    .filter((row) => !row.attended_at)
    .map((row) => serialize(row));
  const history = rows
    .filter((row) => row.attended_at)
    .map((row) => serialize(row));
  return {
    pending,
    history,
    pending_count: pending.length,
  };
};

export const attendWaiterNotificationController = async (
  notificationId: number,
  userId: number,
  role: UserRole
): Promise<WaiterNotificationRow> => {
  if (role !== "mesero" && role !== "admin") {
    throw new AppError("Solo el mesero atiende estas notificaciones", 403);
  }
  const row = await WaiterNotification.findByPk(notificationId, {
    include: [orderInclude],
  });
  if (!row) throw new AppError("Notificación no encontrada", 404);
  if (row.waiter_id !== userId) {
    throw new AppError("Esa notificación no te corresponde", 403);
  }
  if (!row.attended_at) {
    row.attended_at = new Date();
    await row.save();
    publishLive("notifications");
  }
  return serialize(row);
};
