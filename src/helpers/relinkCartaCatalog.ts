import { Category } from "../models/Category";
import { Dish } from "../models/Dish";
import { CARTA_CATEGORIES, CARTA_DISHES } from "../scripts/cartaTimboSet2026";

const keyOf = (name: string, presentation: string) =>
  `${name.trim().toLowerCase()}::${presentation.trim().toLowerCase()}`;

export const relinkCartaCatalog = async () => {
  const categoryByName = new Map<string, Category>();
  for (const [index, name] of CARTA_CATEGORIES.entries()) {
    const [category] = await Category.findOrCreate({
      where: { name },
      defaults: {
        name,
        is_active: true,
        sort_order: index + 1,
      },
    });
    if (!category.is_active) category.is_active = true;
    category.sort_order = index + 1;
    await category.save();
    categoryByName.set(name, category);
  }

  const byExact = new Map<string, (typeof CARTA_DISHES)[number]>();
  const byName = new Map<string, (typeof CARTA_DISHES)[number][]>();
  for (const item of CARTA_DISHES) {
    byExact.set(keyOf(item.name, item.presentation), item);
    const list = byName.get(item.name.trim().toLowerCase()) ?? [];
    list.push(item);
    byName.set(item.name.trim().toLowerCase(), list);
  }

  const dishes = await Dish.findAll();
  let linked = 0;
  for (const dish of dishes) {
    const nameKey = dish.name.trim().toLowerCase();
    const named = byName.get(nameKey) ?? [];
    const item =
      byExact.get(keyOf(dish.name, dish.presentation ?? "")) ??
      (named.length === 1 ? named[0] : undefined);
    if (!item) continue;
    const category = categoryByName.get(item.category);
    if (!category) continue;
    if (
      Number(dish.category_id) === category.id &&
      dish.category_disabled === false
    ) {
      continue;
    }
    dish.category_id = category.id;
    dish.category_disabled = false;
    await dish.save();
    linked += 1;
  }

  console.log(
    `Carta: ${categoryByName.size} categorías, ${linked} platos reenlazados.`
  );
};
