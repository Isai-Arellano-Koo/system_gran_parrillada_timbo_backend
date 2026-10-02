import { User } from "./User";
import { Ingredient } from "./Ingredient";
import { Dish } from "./Dish";
import { RecipeItem } from "./RecipeItem";
import { Table } from "./Table";
import { Order } from "./Order";
import { OrderDetail } from "./OrderDetail";
import { KitchenTicket } from "./KitchenTicket";
import { InventoryMovement } from "./InventoryMovement";

Dish.hasMany(RecipeItem, {
  foreignKey: "dish_id",
  as: "recipe_items",
  onDelete: "CASCADE",
});
RecipeItem.belongsTo(Dish, { foreignKey: "dish_id", as: "dish" });

Ingredient.hasMany(RecipeItem, {
  foreignKey: "ingredient_id",
  as: "recipe_items",
});
RecipeItem.belongsTo(Ingredient, {
  foreignKey: "ingredient_id",
  as: "ingredient",
});

Table.hasMany(Order, { foreignKey: "table_id", as: "orders" });
Order.belongsTo(Table, { foreignKey: "table_id", as: "table" });

User.hasMany(Order, { foreignKey: "waiter_id", as: "orders" });
Order.belongsTo(User, { foreignKey: "waiter_id", as: "waiter" });

Order.hasMany(OrderDetail, {
  foreignKey: "order_id",
  as: "details",
  onDelete: "CASCADE",
});
OrderDetail.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Dish.hasMany(OrderDetail, { foreignKey: "dish_id", as: "order_details" });
OrderDetail.belongsTo(Dish, { foreignKey: "dish_id", as: "dish" });

Order.hasOne(KitchenTicket, {
  foreignKey: "order_id",
  as: "kitchen_ticket",
  onDelete: "CASCADE",
});
KitchenTicket.belongsTo(Order, { foreignKey: "order_id", as: "order" });

User.hasMany(KitchenTicket, {
  foreignKey: "status_changed_by",
  as: "kitchen_updates",
});
KitchenTicket.belongsTo(User, {
  foreignKey: "status_changed_by",
  as: "status_changed_by_user",
});

Ingredient.hasMany(InventoryMovement, {
  foreignKey: "ingredient_id",
  as: "movements",
});
InventoryMovement.belongsTo(Ingredient, {
  foreignKey: "ingredient_id",
  as: "ingredient",
});

User.hasMany(InventoryMovement, {
  foreignKey: "user_id",
  as: "inventory_movements",
});
InventoryMovement.belongsTo(User, { foreignKey: "user_id", as: "user" });

Order.hasMany(InventoryMovement, {
  foreignKey: "order_id",
  as: "inventory_movements",
});
InventoryMovement.belongsTo(Order, { foreignKey: "order_id", as: "order" });

export {
  User,
  Ingredient,
  Dish,
  RecipeItem,
  Table,
  Order,
  OrderDetail,
  KitchenTicket,
  InventoryMovement,
};
