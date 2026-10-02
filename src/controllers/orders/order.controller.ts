import {
  Dish,
  Ingredient,
  InventoryMovement,
  KitchenTicket,
  Order,
  OrderDetail,
  RecipeItem,
  Table,
  User,
} from "../../models";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";
import type { KitchenStatus } from "../../types/enums";

type DetailInput = {
  dish_id?: number;
  quantity?: number;
  observation?: string;
};

const generateOrderCode = () => {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ORD-${stamp}-${rand}`;
};

const loadOrder = async (orderId: number) => {
  const order = await Order.findByPk(orderId, {
    include: [
      { model: Table, as: "table" },
      { model: User, as: "waiter", attributes: ["id", "name", "email"] },
      {
        model: OrderDetail,
        as: "details",
        include: [{ model: Dish, as: "dish" }],
      },
      { model: KitchenTicket, as: "kitchen_ticket" },
    ],
  });
  if (!order) throw new AppError("Pedido no encontrado", 404);
  return order;
};

const calcRequiredStock = async (orderId: number) => {
  const details = await OrderDetail.findAll({
    where: { order_id: orderId },
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
      throw new AppError(
        `El plato "${dish?.name || detail.dish_id}" no tiene receta asociada`
      );
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

  return { details, required };
};

export const listTablesController = async () => {
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

  return Table.findAll({
    where: { is_active: true },
    order: [["number", "ASC"]],
  });
};

export const seedTablesController = async (count = 30) => {
  const existing = await Table.count();
  if (existing > 0) {
    return Table.findAll({ order: [["number", "ASC"]] });
  }

  const rows = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    capacity: 4,
    is_active: true,
  }));
  await Table.bulkCreate(rows);
  return Table.findAll({ order: [["number", "ASC"]] });
};

export const openOrderController = async (tableId: number, waiterId: number) => {
  if (!tableId) throw new AppError("Debe seleccionar una mesa");

  const table = await Table.findByPk(tableId);
  if (!table || !table.is_active) {
    throw new AppError("Mesa no válida", 404);
  }

  const open = await Order.findOne({
    where: { table_id: tableId, status: "en_edicion" },
  });
  if (open) {
    throw new AppError("La mesa ya tiene un pedido en edición");
  }

  const order = await Order.create({
    code: generateOrderCode(),
    table_id: tableId,
    waiter_id: waiterId,
    status: "en_edicion",
    total: 0,
  });

  return loadOrder(order.id);
};

export const listOrdersController = async () => {
  return Order.findAll({
    include: [
      { model: Table, as: "table" },
      { model: User, as: "waiter", attributes: ["id", "name"] },
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

export const getOrderController = async (orderId: number) => {
  return loadOrder(orderId);
};

export const addOrderDetailController = async (
  orderId: number,
  data: DetailInput
) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "en_edicion") {
    throw new AppError("Solo se pueden editar pedidos en edición");
  }

  const dishId = Number(data.dish_id);
  const quantity = Number(data.quantity);
  if (!dishId) throw new AppError("Debe seleccionar un plato");
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError("La cantidad debe ser un entero mayor que cero");
  }

  const dish = await Dish.findByPk(dishId);
  if (!dish || !dish.is_active) {
    throw new AppError("El plato no está disponible");
  }

  await OrderDetail.create({
    order_id: orderId,
    dish_id: dishId,
    quantity,
    unit_price: Number(dish.price),
    observation: data.observation?.trim() || null,
  });

  const details = await OrderDetail.findAll({ where: { order_id: orderId } });
  order.total = details.reduce(
    (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
    0
  );
  await order.save();

  return loadOrder(orderId);
};

export const removeOrderDetailController = async (
  orderId: number,
  detailId: number
) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "en_edicion") {
    throw new AppError("Solo se pueden editar pedidos en edición");
  }

  const detail = await OrderDetail.findOne({
    where: { id: detailId, order_id: orderId },
  });
  if (!detail) throw new AppError("Detalle no encontrado", 404);
  await detail.destroy();

  const details = await OrderDetail.findAll({ where: { order_id: orderId } });
  order.total = details.reduce(
    (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
    0
  );
  await order.save();

  return loadOrder(orderId);
};

export const validateStockController = async (orderId: number) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "en_edicion") {
    throw new AppError("El pedido no está en edición");
  }

  const { details, required } = await calcRequiredStock(orderId);
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
  return sequelize.transaction(async (t) => {
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

    const expectedTotal = details.reduce(
      (sum, d) => sum + Number(d.unit_price) * Number(d.quantity),
      0
    );
    order.total = expectedTotal;
    order.status = "confirmado";
    order.confirmed_at = new Date();
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

    return loadOrder(orderId);
  });
};

export const cancelOrderController = async (
  orderId: number,
  reason: string,
  userId: number
) => {
  const cancelReason = reason?.trim();
  if (!cancelReason) throw new AppError("La cancelación exige un motivo");

  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
      include: [{ model: KitchenTicket, as: "kitchen_ticket" }],
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status === "cancelado") {
      throw new AppError("El pedido ya está cancelado");
    }

    const ticket = order.get("kitchen_ticket") as KitchenTicket | undefined;

    if (order.status === "confirmado" && ticket) {
      const movements = await InventoryMovement.findAll({
        where: { order_id: orderId, type: "salida_venta" },
        transaction: t,
      });

      const kitchenStatus = ticket.status as KitchenStatus;

      for (const movement of movements) {
        if (kitchenStatus === "pendiente") {
          const ingredient = await Ingredient.findByPk(movement.ingredient_id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (ingredient) {
            ingredient.stock_current =
              Number(ingredient.stock_current) + Number(movement.quantity);
            await ingredient.save({ transaction: t });
          }

          await InventoryMovement.create(
            {
              ingredient_id: movement.ingredient_id,
              type: "devolucion",
              quantity: Number(movement.quantity),
              reason: `Reposición por cancelación: ${cancelReason}`,
              order_id: orderId,
              user_id: userId,
            },
            { transaction: t }
          );
        } else if (
          kitchenStatus === "en_preparacion" ||
          kitchenStatus === "listo"
        ) {
          await InventoryMovement.create(
            {
              ingredient_id: movement.ingredient_id,
              type: "merma",
              quantity: Number(movement.quantity),
              reason: `Merma por cancelación: ${cancelReason}`,
              order_id: orderId,
              user_id: userId,
            },
            { transaction: t }
          );
        }
      }
    }

    order.status = "cancelado";
    order.cancel_reason = cancelReason;
    order.cancelled_at = new Date();
    await order.save({ transaction: t });

    return loadOrder(orderId);
  });
};
