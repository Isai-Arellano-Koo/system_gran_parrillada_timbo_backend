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

export const listKitchenTicketsController = async () => {
  return KitchenTicket.findAll({
    include: [
      {
        model: Order,
        as: "order",
        include: [
          { model: Table, as: "table" },
          {
            model: OrderDetail,
            as: "details",
            include: [{ model: Dish, as: "dish" }],
          },
        ],
      },
      {
        model: User,
        as: "status_changed_by_user",
        attributes: ["id", "name"],
      },
    ],
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

  return KitchenTicket.findByPk(ticketId, {
    include: [
      {
        model: Order,
        as: "order",
        include: [
          { model: Table, as: "table" },
          {
            model: OrderDetail,
            as: "details",
            include: [{ model: Dish, as: "dish" }],
          },
        ],
      },
    ],
  });
};
