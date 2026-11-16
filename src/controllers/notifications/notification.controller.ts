import { UniqueConstraintError } from "sequelize";
import {
  KitchenTicket,
  Order,
  Table,
  WaiterNotification,
} from "../../models";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";

export type WaiterNotificationRow = {
  id: number;
  order_id: number;
  kitchen_ticket_id: number;
  waiter_id: number;
  order_code: string;
  table_label: string;
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

const serialize = (row: WaiterNotification): WaiterNotificationRow => ({
  id: Number(row.id),
  order_id: Number(row.order_id),
  kitchen_ticket_id: Number(row.kitchen_ticket_id),
  waiter_id: Number(row.waiter_id),
  order_code: row.order_code,
  table_label: row.table_label,
  generated_at: row.created_at
    ? new Date(row.created_at).toISOString()
    : new Date(row.ticket_ready_at).toISOString(),
  attended_at: row.attended_at ? new Date(row.attended_at).toISOString() : null,
});

export const notifyWaiterTicketReady = async (
  ticketId: number
): Promise<WaiterNotificationRow | null> => {
  const ticket = await KitchenTicket.findByPk(ticketId, {
    include: [
      {
        model: Order,
        as: "order",
        include: [
          { model: Table, as: "table" },
          { model: Table, as: "tables", through: { attributes: [] } },
        ],
      },
    ],
  });
  if (!ticket || ticket.status !== "listo") return null;
  const order = ticket.get("order") as Order | undefined;
  if (!order) return null;

  const readyAt = ticket.status_changed_at || new Date();
  try {
    const created = await WaiterNotification.create({
      kitchen_ticket_id: ticket.id,
      order_id: order.id,
      waiter_id: order.waiter_id,
      order_code: order.code,
      table_label: tableLabelFromOrder(order),
      ticket_ready_at: readyAt,
      attended_at: null,
    });
    return serialize(created);
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
    order: [["created_at", "DESC"]],
    limit: 80,
  });
  const pending = rows.filter((row) => !row.attended_at).map(serialize);
  const history = rows.filter((row) => row.attended_at).map(serialize);
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
  const row = await WaiterNotification.findByPk(notificationId);
  if (!row) throw new AppError("Notificación no encontrada", 404);
  if (row.waiter_id !== userId) {
    throw new AppError("Esa notificación no te corresponde", 403);
  }
  if (!row.attended_at) {
    row.attended_at = new Date();
    await row.save();
  }
  return serialize(row);
};
