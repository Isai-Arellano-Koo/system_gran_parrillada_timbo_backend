import { Ingredient, InventoryMovement, User } from "../../models";
import { sequelize } from "../../config/database";
import { AppError } from "../../middlewares/errorHandler";

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

export const listMovementsController = async () => {
  return InventoryMovement.findAll({
    include: [
      { model: Ingredient, as: "ingredient", attributes: ["id", "name", "unit"] },
      { model: User, as: "user", attributes: ["id", "name", "email"] },
    ],
    order: [["created_at", "DESC"]],
  });
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
    .filter((item) => Number(item.stock_current) <= Number(item.stock_minimum))
    .map((item) => ({
      ingredient_id: item.id,
      name: item.name,
      unit: item.unit,
      stock_current: Number(item.stock_current),
      stock_minimum: Number(item.stock_minimum),
    }));
};
