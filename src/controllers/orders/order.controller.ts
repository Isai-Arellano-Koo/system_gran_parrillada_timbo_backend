import {
  Category,
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
import { Op, type Transaction } from "sequelize";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";
import type { KitchenStatus } from "../../types/enums";

type DetailInput = {
  dish_id?: number;
  quantity?: number;
  observation?: string;
};

const limaDayMonth = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value || "00";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  return `${day}${month}`;
};

// Mesa + día/mes + correlativo del día. Ej: M01-2610-03
const generateOrderCode = async (tableNumber: number) => {
  const mesa = String(tableNumber).padStart(2, "0");
  const prefix = `M${mesa}-${limaDayMonth()}-`;
  const count = await Order.count({
    where: { code: { [Op.like]: `${prefix}%` } },
  });
  for (let step = 1; step <= 20; step++) {
    const code = `${prefix}${String(count + step).padStart(2, "0")}`;
    const taken = await Order.findOne({ where: { code } });
    if (!taken) return code;
  }
  return `${prefix}${Math.floor(Math.random() * 90 + 10)}`;
};

// Trae el pedido con mesa, mesero, platos y comanda
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

  return { details, required };
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

export const listTablesController = async () => {
  const count = await Table.count();
  // Si no hay mesas, crea 30 para poder abrir pedidos
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

  // Sigue ocupada mientras comen, aunque el pedido ya haya ido a cocina
  const open = await Order.findOne({
    where: {
      table_id: tableId,
      status: { [Op.in]: ["en_edicion", "confirmado"] },
    },
  });
  if (open) {
    throw new AppError("La mesa sigue ocupada");
  }

  const order = await Order.create({
    code: await generateOrderCode(table.number),
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

  return loadOrder(orderId);
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

  return loadOrder(orderId);
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
      return loadOrder(orderId);
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
  return loadOrder(orderId);
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
      await detail.save({ transaction: t });
    }

    return loadOrder(orderId);
  });
};

export const sendAdditionsController = async (orderId: number) => {
  return sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new AppError("Pedido no encontrado", 404);
    if (order.status !== "confirmado") {
      throw new AppError("Solo se envían adicionales de un pedido en mesa");
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
    return loadOrder(orderId);
  });
};

export const setOrderPaidController = async (orderId: number, paid: boolean) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "confirmado") {
    throw new AppError("Solo se registra el pago de una mesa ocupada");
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
  return loadOrder(orderId);
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
    if (order.status === "cerrado") {
      throw new AppError("El pedido ya está cerrado y la mesa fue liberada");
    }

    const ticket = order.get("kitchen_ticket") as KitchenTicket | undefined;

    // Si cocina todavía no empezó, el stock vuelve. Si ya se cocinó, es merma
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

export const closeOrderController = async (orderId: number) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.status !== "confirmado") {
    throw new AppError("Solo se libera una mesa con pedido confirmado");
  }
  const pending = await OrderDetail.count({
    where: { order_id: orderId, sent_to_kitchen: false },
  });
  if (pending > 0) {
    throw new AppError("Hay platos nuevos sin enviar a cocina");
  }
  if (dueAmount(order) > 0.009) {
    throw new AppError("La mesa tiene un saldo pendiente");
  }
  order.status = "cerrado";
  order.closed_at = new Date();
  await order.save();
  return loadOrder(orderId);
};
