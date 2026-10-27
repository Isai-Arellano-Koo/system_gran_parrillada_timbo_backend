import {
  Dish,
  KitchenTicket,
  Order,
  OrderDetail,
  Table,
  User,
} from "../../models";
import { AppError } from "../../middlewares/errorHandler";
import { KITCHEN_STATUSES, type KitchenStatus } from "../../types/enums";

const ticketInclude = [
  {
    model: Order,
    as: "order",
    include: [
      { model: Table, as: "table" },
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
];

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
  ticket.status = next;
  ticket.status_changed_by = userId;
  ticket.status_changed_at = new Date();
  await ticket.save();
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

  ticket.status = status;
  ticket.status_changed_by = userId;
  ticket.status_changed_at = new Date();
  await ticket.save();

  const details = await OrderDetail.findAll({
    where: { order_id: ticket.order_id, sent_to_kitchen: true },
  });
  const rank = (value: KitchenStatus) => KITCHEN_STATUSES.indexOf(value);
  for (const detail of details) {
    const current = (detail.kitchen_status || "pendiente") as KitchenStatus;
    if (rank(current) < rank(status)) {
      detail.kitchen_status = status;
      await detail.save();
    }
  }

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

  detail.kitchen_status = status;
  await detail.save();
  await syncTicketFromDishes(detail.order_id, userId);

  const ticket = await KitchenTicket.findOne({
    where: { order_id: detail.order_id },
  });
  if (!ticket) throw new AppError("Comanda no encontrada", 404);
  return loadTicket(ticket.id);
};
