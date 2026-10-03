import { Op } from "sequelize";
import { Ingredient, Dish, RecipeItem } from "../../models";
import { AppError } from "../../middlewares/errorHandler";
import {
  MEASUREMENT_UNITS,
  type MeasurementUnit,
} from "../../types/enums";

type IngredientInput = {
  name?: string;
  unit?: MeasurementUnit;
  stock_minimum?: number;
  is_active?: boolean;
};

type DishInput = {
  name?: string;
  price?: number;
  description?: string;
  is_active?: boolean;
};

type RecipeItemInput = {
  ingredient_id: number;
  quantity: number;
};

export const listIngredientsController = async (activeOnly = false) => {
  return Ingredient.findAll({
    where: activeOnly ? { is_active: true } : undefined,
    order: [["name", "ASC"]],
  });
};

export const createIngredientController = async (data: IngredientInput) => {
  const name = data.name?.trim();
  if (!name) {
    throw new AppError("El nombre es obligatorio");
  }
  if (!data.unit || !MEASUREMENT_UNITS.includes(data.unit)) {
    throw new AppError("La unidad de medida es inválida");
  }

  const existing = await Ingredient.findOne({ where: { name } });
  if (existing) {
    throw new AppError("Ya existe un ingrediente con ese nombre");
  }

  return Ingredient.create({
    name,
    unit: data.unit,
    stock_minimum: Number(data.stock_minimum ?? 0),
    is_active: data.is_active ?? true,
  });
};

export const updateIngredientController = async (
  id: number,
  data: IngredientInput
) => {
  const ingredient = await Ingredient.findByPk(id);
  if (!ingredient) {
    throw new AppError("Ingrediente no encontrado", 404);
  }

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new AppError("El nombre es obligatorio");
    const duplicate = await Ingredient.findOne({
      where: { name, id: { [Op.ne]: id } },
    });
    if (duplicate) {
      throw new AppError("Ya existe un ingrediente con ese nombre");
    }
    ingredient.name = name;
  }

  if (data.unit !== undefined) {
    if (!MEASUREMENT_UNITS.includes(data.unit)) {
      throw new AppError("La unidad de medida es inválida");
    }
    ingredient.unit = data.unit;
  }

  if (data.stock_minimum !== undefined) {
    ingredient.stock_minimum = Number(data.stock_minimum);
  }

  if (data.is_active !== undefined) {
    ingredient.is_active = Boolean(data.is_active);
  }

  await ingredient.save();
  return ingredient;
};

export const listDishesController = async (activeOnly = false) => {
  return Dish.findAll({
    where: activeOnly ? { is_active: true } : undefined,
    include: [
      {
        model: RecipeItem,
        as: "recipe_items",
        include: [{ model: Ingredient, as: "ingredient" }],
      },
    ],
    order: [["name", "ASC"]],
  });
};

export const createDishController = async (data: DishInput) => {
  const name = data.name?.trim();
  const price = Number(data.price);

  if (!name) throw new AppError("El nombre es obligatorio");
  if (!price || price <= 0) throw new AppError("El precio debe ser mayor que cero");

  const existing = await Dish.findOne({ where: { name } });
  if (existing) throw new AppError("Ya existe un plato con ese nombre");

  return Dish.create({
    name,
    price,
    description: data.description?.trim() || null,
    is_active: data.is_active ?? true,
  });
};

export const updateDishController = async (id: number, data: DishInput) => {
  const dish = await Dish.findByPk(id);
  if (!dish) throw new AppError("Plato no encontrado", 404);

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new AppError("El nombre es obligatorio");
    const duplicate = await Dish.findOne({
      where: { name, id: { [Op.ne]: id } },
    });
    if (duplicate) throw new AppError("Ya existe un plato con ese nombre");
    dish.name = name;
  }

  if (data.price !== undefined) {
    const price = Number(data.price);
    if (!price || price <= 0) {
      throw new AppError("El precio debe ser mayor que cero");
    }
    dish.price = price;
  }

  if (data.description !== undefined) {
    dish.description = data.description?.trim() || null;
  }

  if (data.is_active !== undefined) {
    dish.is_active = Boolean(data.is_active);
  }

  await dish.save();
  return dish;
};

export const setRecipeController = async (
  dishId: number,
  items: RecipeItemInput[]
) => {
  const dish = await Dish.findByPk(dishId);
  if (!dish) throw new AppError("Plato no encontrado", 404);

  if (!Array.isArray(items)) {
    throw new AppError("La receta no es válida");
  }

  if (items.length === 0) {
    await RecipeItem.destroy({ where: { dish_id: dishId } });
    const dishes = await listDishesController();
    return dishes.find((d) => d.id === dishId);
  }

  const seen = new Set<number>();
  for (const item of items) {
    if (!item.ingredient_id) {
      throw new AppError("Cada ítem debe indicar ingredient_id");
    }
    if (seen.has(item.ingredient_id)) {
      throw new AppError("No se puede repetir un ingrediente en la misma receta");
    }
    seen.add(item.ingredient_id);

    const qty = Number(item.quantity);
    if (!qty || qty <= 0) {
      throw new AppError("Cada cantidad debe ser mayor que cero");
    }

    const ingredient = await Ingredient.findByPk(item.ingredient_id);
    if (!ingredient || !ingredient.is_active) {
      throw new AppError(`Ingrediente ${item.ingredient_id} no válido`);
    }
  }

  await RecipeItem.destroy({ where: { dish_id: dishId } });
  await RecipeItem.bulkCreate(
    items.map((item) => ({
      dish_id: dishId,
      ingredient_id: item.ingredient_id,
      quantity: Number(item.quantity),
    }))
  );

  return listDishesController().then((dishes) =>
    dishes.find((d) => d.id === dishId)
  );
};
