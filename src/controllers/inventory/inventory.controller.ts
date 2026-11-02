import { Ingredient, InventoryMovement, Order, Table, User } from "../../models";
import { Op } from "sequelize";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";
import { INVENTORY_MOVEMENT_TYPES } from "../../types/enums";

type StockEntryInput = {
  ingredient_id?: number;
  quantity?: number;
  reason?: string;
};

export const registerStockEntryController = async (
  data: StockEntryInput,
  userId: number
) => {
  const ingredientId = Number(data.ingredient_id);
  const quantity = Number(data.quantity);
  const reason = data.reason?.trim() || "Entrada de stock";

  if (!ingredientId) throw new AppError("Debe seleccionar un ingrediente");
  if (!quantity || quantity <= 0) {
    throw new AppError("La cantidad debe ser mayor que cero");
  }

  return sequelize.transaction(async (t) => {
    // Bloqueamos la fila para que dos entradas no pisen el stock
    const ingredient = await Ingredient.findByPk(ingredientId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!ingredient) throw new AppError("Ingrediente no encontrado", 404);

    const current = Number(ingredient.stock_current);
    ingredient.stock_current = current + quantity;
    await ingredient.save({ transaction: t });

    const movement = await InventoryMovement.create(
      {
        ingredient_id: ingredientId,
        type: "entrada",
        quantity,
        reason,
        user_id: userId,
        order_id: null,
      },
      { transaction: t }
    );

    return {
      ingredient,
      movement,
    };
  });
};

export const adjustStockController = async (
  data: { ingredient_id?: number; stock_current?: number; reason?: string },
  userId: number
) => {
  const ingredientId = Number(data.ingredient_id);
  const next = Number(data.stock_current);

  if (!ingredientId) throw new AppError("Debe seleccionar un ingrediente");
  if (!Number.isFinite(next) || next < 0) {
    throw new AppError("El stock no puede ser negativo");
  }

  return sequelize.transaction(async (t) => {
    const ingredient = await Ingredient.findByPk(ingredientId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!ingredient) throw new AppError("Ingrediente no encontrado", 404);

    const current = Number(ingredient.stock_current);
    const delta = Number((next - current).toFixed(3)); // diferencia entre lo que hay y lo que pusieron

    if (Math.abs(delta) < 0.0005) {
      return { ingredient, movement: null };
    }

    ingredient.stock_current = next;
    await ingredient.save({ transaction: t });

    const movement = await InventoryMovement.create(
      {
        ingredient_id: ingredientId,
        type: "ajuste",
        quantity: Math.abs(delta),
        reason:
          data.reason?.trim() ||
          `Ajuste de stock: ${current} → ${next} ${ingredient.unit}`,
        user_id: userId,
        order_id: null,
      },
      { transaction: t }
    );

    return { ingredient, movement };
  });
};

export const listMovementsController = async (filters: {
  ingredient_id?: string;
  type?: string;
  user_id?: string;
  from?: string;
  to?: string;
} = {}) => {
  const where: Record<string, unknown> = {};
  const ingredientId = Number(filters.ingredient_id);
  const userId = Number(filters.user_id);
  if (ingredientId) where.ingredient_id = ingredientId;
  if (userId) where.user_id = userId;
  if (
    filters.type &&
    INVENTORY_MOVEMENT_TYPES.includes(
      filters.type as (typeof INVENTORY_MOVEMENT_TYPES)[number]
    )
  ) {
    where.type = filters.type;
  }

  if (filters.from || filters.to) {
    const createdAt: { [Op.gte]?: Date; [Op.lte]?: Date } = {};
    if (filters.from) createdAt[Op.gte] = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
        end.setHours(23, 59, 59, 999);
      }
      createdAt[Op.lte] = end;
    }
    where.created_at = createdAt;
  }

  return InventoryMovement.findAll({
    where,
    include: [
      { model: Ingredient, as: "ingredient", attributes: ["id", "name", "unit"] },
      { model: User, as: "user", attributes: ["id", "name", "email"] },
      {
        model: Order,
        as: "order",
        attributes: ["id", "code", "table_id"],
        include: [{ model: Table, as: "table", attributes: ["id", "number"] }],
      },
    ],
    order: [["created_at", "DESC"]],
  });
};

export const rejectDeleteMovementController = async () => {
  throw new AppError(
    "Un movimiento confirmado no se elimina. Registra una entrada o un ajuste para corregir el stock.",
    409
  );
};

export const listLowStockAlertsController = async (): Promise<
  Array<{
    ingredient_id: number;
    name: string;
    unit: string;
    stock_current: number;
    stock_minimum: number;
  }>
> => {
  const ingredients = await Ingredient.findAll({
    where: { is_active: true },
    order: [["name", "ASC"]],
  });

  return ingredients
    .filter((item) => Number(item.stock_current) <= Number(item.stock_minimum)) // alerta si está en el mínimo o más abajo
    .map((item) => ({
      ingredient_id: item.id,
      name: item.name,
      unit: item.unit,
      stock_current: Number(item.stock_current),
      stock_minimum: Number(item.stock_minimum),
    }));
};
