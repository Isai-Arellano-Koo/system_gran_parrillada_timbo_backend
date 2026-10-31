import { Op } from "sequelize";
import {
  Ingredient,
  Dish,
  RecipeItem,
  DishStatusChange,
  User,
  Category,
} from "../../models";
import { AppError } from "../../middlewares/errorHandler";
import {
  MEASUREMENT_UNITS,
  type MeasurementUnit,
} from "../../types/enums";

type IngredientInput = {
  name?: string;
  unit?: MeasurementUnit;
  stock_minimum?: number;
  stock_current?: unknown;
  is_active?: boolean;
};

const rejectDirectStockEdit = (data: IngredientInput) => {
  if (data.stock_current !== undefined) {
    throw new AppError(
      "El stock actual se registra desde Inventario, no desde Ingredientes"
    );
  }
};

const parseStockMinimum = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("El stock mínimo no puede ser negativo ni inválido");
  }
  return amount;
};

type DishInput = {
  name?: string;
  presentation?: string;
  price?: number;
  description?: string;
  category_id?: number;
  is_active?: boolean;
  status_reason?: string;
};

type CategoryInput = {
  name?: string;
};

const CATEGORY_REMOVED_REASON = "Categoría quitada de la carta";
const CATEGORY_RESTORED_REASON = "Categoría vuelta a la carta";

const dishIncludes = [
  {
    model: Category,
    as: "category" as const,
  },
  {
    model: RecipeItem,
    as: "recipe_items" as const,
    include: [{ model: Ingredient, as: "ingredient" }],
  },
];

const requireActiveCategory = async (categoryId: number) => {
  const category = await Category.findByPk(categoryId);
  if (!category) {
    throw new AppError("La categoría no existe");
  }
  if (!category.is_active) {
    throw new AppError(
      "El plato debe asignarse a una categoría existente y activa"
    );
  }
  return category;
};

const recordDishStatus = async (
  dish: Dish,
  actorId: number,
  previous: boolean,
  next: boolean,
  reason: string
) => {
  await DishStatusChange.create({
    dish_id: dish.id,
    previous_is_active: previous,
    next_is_active: next,
    reason,
    changed_by: actorId,
  });
};

const setCategoryActive = async (
  category: Category,
  actorId: number,
  nextActive: boolean
) => {
  if (category.is_active === nextActive) {
    return category;
  }

  category.is_active = nextActive;
  await category.save();

  const dishes = await Dish.findAll({ where: { category_id: category.id } });
  for (const dish of dishes) {
    if (!nextActive) {
      if (dish.is_active) {
        dish.is_active = false;
        dish.category_disabled = true;
        await dish.save();
        await recordDishStatus(
          dish,
          actorId,
          true,
          false,
          CATEGORY_REMOVED_REASON
        );
      }
    } else if (dish.category_disabled) {
      dish.is_active = true;
      dish.category_disabled = false;
      await dish.save();
      await recordDishStatus(
        dish,
        actorId,
        false,
        true,
        CATEGORY_RESTORED_REASON
      );
    }
  }

  return category;
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
  rejectDirectStockEdit(data);
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
    stock_minimum: parseStockMinimum(data.stock_minimum ?? 0),
    is_active: data.is_active ?? true,
  });
};

export const updateIngredientController = async (
  id: number,
  data: IngredientInput
) => {
  rejectDirectStockEdit(data);
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
    ingredient.stock_minimum = parseStockMinimum(data.stock_minimum);
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
    include: activeOnly
      ? [
          {
            model: Category,
            as: "category",
            where: { is_active: true },
            required: true,
          },
          dishIncludes[1],
        ]
      : dishIncludes,
    order: [
      [{ model: Category, as: "category" }, "sort_order", "ASC"],
      ["name", "ASC"],
      ["presentation", "ASC"],
    ],
  });
};

export const getDishController = async (id: number, activeOnly = false) => {
  const dish = await Dish.findByPk(id, { include: dishIncludes });
  const category = (dish as Dish & { category?: Category | null })?.category;
  if (
    !dish ||
    (activeOnly && (!dish.is_active || !category?.is_active))
  ) {
    throw new AppError("Plato no encontrado", 404);
  }
  return dish;
};

export const createDishController = async (data: DishInput) => {
  const name = data.name?.trim();
  const presentation = (data.presentation || "").trim();
  const price = Number(data.price);
  const categoryId = Number(data.category_id);

  if (!name) throw new AppError("El nombre es obligatorio");
  if (!price || price <= 0) throw new AppError("El precio debe ser mayor que cero");
  if (!categoryId) {
    throw new AppError("El plato debe asignarse a una categoría existente");
  }
  await requireActiveCategory(categoryId);

  const existing = await Dish.findOne({ where: { name, presentation } });
  if (existing) throw new AppError("Ya existe un plato con ese nombre y presentación");

  const created = await Dish.create({
    category_id: categoryId,
    name,
    presentation,
    price,
    description: data.description?.trim() || null,
    is_active: data.is_active ?? true,
    category_disabled: false,
  });
  return getDishController(created.id);
};

export const updateDishController = async (
  id: number,
  actorId: number,
  data: DishInput
) => {
  const dish = await Dish.findByPk(id);
  if (!dish) throw new AppError("Plato no encontrado", 404);

  if (data.category_id !== undefined) {
    const category = await requireActiveCategory(Number(data.category_id));
    dish.category_id = category.id;
    if (dish.category_disabled) {
      dish.category_disabled = false;
    }
  }

  if (data.name !== undefined || data.presentation !== undefined) {
    const name = (data.name ?? dish.name).trim();
    const presentation = (data.presentation ?? dish.presentation ?? "").trim();
    if (!name) throw new AppError("El nombre es obligatorio");
    const duplicate = await Dish.findOne({
      where: { name, presentation, id: { [Op.ne]: id } },
    });
    if (duplicate) {
      throw new AppError("Ya existe un plato con ese nombre y presentación");
    }
    dish.name = name;
    dish.presentation = presentation;
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

  const nextActive =
    data.is_active === undefined ? dish.is_active : Boolean(data.is_active);
  const statusChanged = nextActive !== dish.is_active;
  let statusReason = "";
  if (statusChanged) {
    statusReason = (data.status_reason || "").trim();
    if (statusReason.length < 3) {
      throw new AppError("Indica el motivo del cambio de estado");
    }
    if (nextActive) {
      const category = await Category.findByPk(dish.category_id);
      if (!category?.is_active) {
        throw new AppError(
          "No se puede habilitar el plato hasta que se vuelva a agregar su categoría"
        );
      }
      dish.category_disabled = false;
    } else {
      dish.category_disabled = false;
    }
  }

  const previousActive = dish.is_active;
  dish.is_active = nextActive;
  await dish.save();

  if (statusChanged) {
    await DishStatusChange.create({
      dish_id: dish.id,
      previous_is_active: previousActive,
      next_is_active: nextActive,
      reason: statusReason,
      changed_by: actorId,
    });
  }

  return dish;
};

export const listDishStatusChangesController = async (dishId: number) => {
  const dish = await Dish.findByPk(dishId, { attributes: ["id"] });
  if (!dish) throw new AppError("Plato no encontrado", 404);

  return DishStatusChange.findAll({
    where: { dish_id: dishId },
    include: [
      { model: User, as: "changed_by_user", attributes: ["id", "name", "email"] },
    ],
    order: [["created_at", "DESC"]],
  });
};

export const setRecipeController = async (
  dishId: number,
  items: RecipeItemInput[]
) => {
  const dish = await Dish.findByPk(dishId);
  if (!dish) throw new AppError("Plato no encontrado", 404);

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("La receta debe tener al menos un ingrediente");
  }

  const currentItems = await RecipeItem.findAll({ where: { dish_id: dishId } });
  const alreadyInRecipe = new Set(currentItems.map((row) => row.ingredient_id));

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
    if (!ingredient) {
      throw new AppError(`Ingrediente ${item.ingredient_id} no válido`);
    }
    // La cantidad va en la unidad del insumo. Si ya estaba en la receta, se puede dejar
    if (!ingredient.is_active && !alreadyInRecipe.has(item.ingredient_id)) {
      throw new AppError(`${ingredient.name} no está activo`);
    }
  }

  // Reemplaza la receta actual. Los pedidos ya confirmados no se tocan
  await RecipeItem.destroy({ where: { dish_id: dishId } });
  await RecipeItem.bulkCreate(
    items.map((item) => ({
      dish_id: dishId,
      ingredient_id: item.ingredient_id,
      quantity: Number(item.quantity),
    }))
  );

  return getDishController(dishId);
};

export const listCategoriesController = async (activeOnly = false) => {
  return Category.findAll({
    where: activeOnly ? { is_active: true } : undefined,
    include: [
      {
        model: Dish,
        as: "dishes",
        attributes: ["id", "name", "presentation", "is_active"],
      },
    ],
    order: [
      ["sort_order", "ASC"],
      ["name", "ASC"],
    ],
  });
};

export const createCategoryController = async (
  actorId: number,
  data: CategoryInput
) => {
  const name = data.name?.trim();
  if (!name) throw new AppError("El nombre de la categoría es obligatorio");

  const existing = await Category.findOne({ where: { name } });
  if (existing) {
    if (existing.is_active) {
      throw new AppError("Ya existe una categoría con ese nombre");
    }
    const maxOrder = (await Category.max("sort_order")) as number | null;
    existing.sort_order = Number(maxOrder ?? 0) + 1;
    await setCategoryActive(existing, actorId, true);
    return existing;
  }

  const maxOrder = (await Category.max("sort_order")) as number | null;
  return Category.create({
    name,
    is_active: true,
    sort_order: Number(maxOrder ?? 0) + 1,
  });
};

export const updateCategoryController = async (
  id: number,
  actorId: number,
  data: CategoryInput & { is_active?: boolean }
) => {
  const category = await Category.findByPk(id);
  if (!category) throw new AppError("Categoría no encontrada", 404);

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new AppError("El nombre de la categoría es obligatorio");
    const duplicate = await Category.findOne({
      where: { name, id: { [Op.ne]: id } },
    });
    if (duplicate) throw new AppError("Ya existe una categoría con ese nombre");
    category.name = name;
    await category.save();
  }

  if (data.is_active !== undefined) {
    await setCategoryActive(category, actorId, Boolean(data.is_active));
  }

  return category;
};

export const removeCategoryController = async (id: number, actorId: number) => {
  const category = await Category.findByPk(id);
  if (!category) throw new AppError("Categoría no encontrada", 404);
  if (!category.is_active) {
    return category;
  }
  await setCategoryActive(category, actorId, false);
  return category;
};
