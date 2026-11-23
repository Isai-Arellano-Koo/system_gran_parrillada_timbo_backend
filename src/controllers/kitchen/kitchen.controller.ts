import {
  Dish,
  KitchenTicket,
  KitchenTicketStatusChange,
  Order,
  OrderDetail,
  Table,
  User,
} from "../../models";
import { Op } from "sequelize";
import { AppError } from "../../middlewares/errorHandler";
import { KITCHEN_STATUSES, type KitchenStatus } from "../../types/enums";
import { notifyWaiterDishReady } from "../notifications/notification.controller";
import { publishLive } from "../../live/hub";

const ticketInclude = [
  {
    model: Order,
    as: "order",
    required: true,
    where: { status: { [Op.ne]: "cancelado" } },
    include: [
      { model: Table, as: "table" },
      {
        model: Table,
        as: "tables",
        through: { attributes: [] },
      },
      { model: User, as: "waiter", attributes: ["id", "name", "role"] },
      {
        model: OrderDetail,
        as: "details",
        where: { sent_to_kitchen: true },
        required: false,
        include: [{ model: Dish, as: "dish" }],
      },
    ],
  },
  {
    model: User,
    as: "status_changed_by_user",
    attributes: ["id", "name"],
  },
  {
    model: KitchenTicketStatusChange,
    as: "history",
    separate: true,
    order: [["created_at", "ASC"] as [string, string]],
  },
];

const nextKitchenStatus = (current: KitchenStatus) => {
  const index = KITCHEN_STATUSES.indexOf(current);
  return index >= 0 && index < KITCHEN_STATUSES.length - 1
    ? KITCHEN_STATUSES[index + 1]
    : null;
};

const recordTicketStatusChange = async (
  ticket: KitchenTicket,
  previous: KitchenStatus,
  next: KitchenStatus,
  userId: number
) => {
  if (previous === next) return;
  ticket.status = next;
  ticket.status_changed_by = userId;
  ticket.status_changed_at = new Date();
  await ticket.save();
  await KitchenTicketStatusChange.create({
    kitchen_ticket_id: ticket.id,
    previous_status: previous,
    new_status: next,
    changed_by: userId,
  });
};

const loadTicket = async (ticketId: number) => {
  const ticket = await KitchenTicket.findByPk(ticketId, {
    include: ticketInclude,
  });
  if (!ticket) throw new AppError("Comanda no encontrada", 404);
  return ticket;
};

const ticketStatusFromDishes = (statuses: KitchenStatus[]): KitchenStatus => {
  if (!statuses.length) return "pendiente";
  if (statuses.every((status) => status === "entregado")) return "entregado";
  if (statuses.every((status) => status === "listo" || status === "entregado")) {
    return "listo";
  }
  if (
    statuses.some(
      (status) =>
        status === "en_preparacion" ||
        status === "listo" ||
        status === "entregado"
    )
  ) {
    return "en_preparacion";
  }
  return "pendiente";
};

const syncTicketFromDishes = async (orderId: number, userId: number) => {
  const details = await OrderDetail.findAll({
    where: { order_id: orderId, sent_to_kitchen: true },
  });
  const ticket = await KitchenTicket.findOne({ where: { order_id: orderId } });
  if (!ticket) return;
  const next = ticketStatusFromDishes(
    details.map((detail) => (detail.kitchen_status || "pendiente") as KitchenStatus)
  );
  if (ticket.status === next) return;
  await recordTicketStatusChange(ticket, ticket.status, next, userId);
};

export const listKitchenTicketsController = async () => {
  return KitchenTicket.findAll({
    include: ticketInclude,
    order: [["created_at", "ASC"]],
  });
};

export const updateKitchenStatusController = async (
  ticketId: number,
  status: KitchenStatus,
  userId: number
) => {
  if (!KITCHEN_STATUSES.includes(status)) {
    throw new AppError("Estado de cocina inválido");
  }

  const ticket = await KitchenTicket.findByPk(ticketId);
  if (!ticket) throw new AppError("Comanda no encontrada", 404);

  if (ticket.status !== status) {
    if (nextKitchenStatus(ticket.status) !== status) {
      throw new AppError(
        "No se puede saltar ni retroceder el flujo de la comanda"
      );
    }
    await recordTicketStatusChange(ticket, ticket.status, status, userId);
  }

  const details = await OrderDetail.findAll({
    where: { order_id: ticket.order_id, sent_to_kitchen: true },
  });
  const rank = (value: KitchenStatus) => KITCHEN_STATUSES.indexOf(value);
  const newlyReady: number[] = [];
  for (const detail of details) {
    const current = (detail.kitchen_status || "pendiente") as KitchenStatus;
    if (rank(current) < rank(status)) {
      if (status === "listo" && current !== "listo") {
        newlyReady.push(detail.id);
      }
      detail.kitchen_status = status;
      await detail.save();
    }
  }

  if (status === "listo") {
    for (const detailId of newlyReady) {
      await notifyWaiterDishReady(detailId);
    }
  }

  publishLive("kitchen", "orders", "notifications");
  return loadTicket(ticketId);
};

export const updateKitchenDishController = async (
  detailId: number,
  status: KitchenStatus,
  userId: number
) => {
  if (!KITCHEN_STATUSES.includes(status)) {
    throw new AppError("Estado de cocina inválido");
  }

  const detail = await OrderDetail.findByPk(detailId);
  if (!detail || !detail.sent_to_kitchen) {
    throw new AppError("Plato no encontrado en cocina", 404);
  }

  const previous = (detail.kitchen_status || "pendiente") as KitchenStatus;
  detail.kitchen_status = status;
  await detail.save();
  await syncTicketFromDishes(detail.order_id, userId);
  if (status === "listo" && previous !== "listo") {
    await notifyWaiterDishReady(detail.id);
  }

  const ticket = await KitchenTicket.findOne({
    where: { order_id: detail.order_id },
  });
  if (!ticket) throw new AppError("Comanda no encontrada", 404);
  publishLive("kitchen", "orders", "notifications");
  return loadTicket(ticket.id);
};
