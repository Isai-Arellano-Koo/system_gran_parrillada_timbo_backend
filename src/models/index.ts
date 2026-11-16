import { User } from "./User";
import { Ingredient } from "./Ingredient";
import { Category } from "./Category";
import { Dish } from "./Dish";
import { RecipeItem } from "./RecipeItem";
import { Table } from "./Table";
import { TableGroup } from "./TableGroup";
import { TableGroupMember } from "./TableGroupMember";
import { TableStatusChange } from "./TableStatusChange";
import { TableGroupChange } from "./TableGroupChange";
import { Order } from "./Order";
import { OrderTable } from "./OrderTable";
import { OrderDetail } from "./OrderDetail";
import { KitchenTicket } from "./KitchenTicket";
import { InventoryMovement } from "./InventoryMovement";
import { EmailVerification } from "./EmailVerification";
import { LoginAttempt } from "./LoginAttempt";
import { LoginLock } from "./LoginLock";
import { UserStatusChange } from "./UserStatusChange";
import { DishStatusChange } from "./DishStatusChange";
import { WaiterNotification } from "./WaiterNotification";

// Relaciones entre tablas. Sequelize las usa al hacer include
Category.hasMany(Dish, {
  foreignKey: "category_id",
  as: "dishes",
});
Dish.belongsTo(Category, { foreignKey: "category_id", as: "category" });

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

Order.belongsToMany(Table, {
  through: OrderTable,
  foreignKey: "order_id",
  otherKey: "table_id",
  as: "tables",
});
Table.belongsToMany(Order, {
  through: OrderTable,
  foreignKey: "table_id",
  otherKey: "order_id",
  as: "joined_orders",
});
OrderTable.belongsTo(Order, { foreignKey: "order_id", as: "order" });
OrderTable.belongsTo(Table, { foreignKey: "table_id", as: "table" });
Order.hasMany(OrderTable, { foreignKey: "order_id", as: "table_links" });
Table.hasMany(OrderTable, { foreignKey: "table_id", as: "order_links" });

TableGroup.hasMany(TableGroupMember, {
  foreignKey: "group_id",
  as: "members",
  onDelete: "CASCADE",
});
TableGroupMember.belongsTo(TableGroup, { foreignKey: "group_id", as: "group" });
Table.hasOne(TableGroupMember, { foreignKey: "table_id", as: "group_member" });
TableGroupMember.belongsTo(Table, { foreignKey: "table_id", as: "table" });
User.hasMany(TableGroup, { foreignKey: "created_by", as: "table_groups" });
TableGroup.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });

Table.hasMany(TableStatusChange, {
  foreignKey: "table_id",
  as: "status_changes",
});
TableStatusChange.belongsTo(Table, { foreignKey: "table_id", as: "table" });
User.hasMany(TableStatusChange, {
  foreignKey: "changed_by",
  as: "table_status_changes_made",
});
TableStatusChange.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changed_by_user",
});

User.hasMany(TableGroupChange, {
  foreignKey: "changed_by",
  as: "table_group_changes_made",
});
TableGroupChange.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changed_by_user",
});

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

User.hasMany(UserStatusChange, { foreignKey: "user_id", as: "status_changes" });
UserStatusChange.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(UserStatusChange, {
  foreignKey: "changed_by",
  as: "status_changes_made",
});
UserStatusChange.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changed_by_user",
});

Dish.hasMany(DishStatusChange, { foreignKey: "dish_id", as: "status_changes" });
DishStatusChange.belongsTo(Dish, { foreignKey: "dish_id", as: "dish" });
User.hasMany(DishStatusChange, {
  foreignKey: "changed_by",
  as: "dish_status_changes_made",
});
DishStatusChange.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changed_by_user",
});

KitchenTicket.hasMany(WaiterNotification, {
  foreignKey: "kitchen_ticket_id",
  as: "waiter_notifications",
});
WaiterNotification.belongsTo(KitchenTicket, {
  foreignKey: "kitchen_ticket_id",
  as: "kitchen_ticket",
});
Order.hasMany(WaiterNotification, {
  foreignKey: "order_id",
  as: "waiter_notifications",
});
WaiterNotification.belongsTo(Order, { foreignKey: "order_id", as: "order" });
OrderDetail.hasMany(WaiterNotification, {
  foreignKey: "order_detail_id",
  as: "waiter_notifications",
});
WaiterNotification.belongsTo(OrderDetail, {
  foreignKey: "order_detail_id",
  as: "order_detail",
});
User.hasMany(WaiterNotification, {
  foreignKey: "waiter_id",
  as: "waiter_notifications",
});
WaiterNotification.belongsTo(User, { foreignKey: "waiter_id", as: "waiter" });

User.hasMany(LoginAttempt, { foreignKey: "user_id", as: "login_attempts" });
LoginAttempt.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(LoginLock, { foreignKey: "user_id", as: "login_locks" });
LoginLock.belongsTo(User, { foreignKey: "user_id", as: "user" });

export {
  User,
  Ingredient,
  Category,
  Dish,
  RecipeItem,
  Table,
  TableGroup,
  TableGroupMember,
  TableStatusChange,
  TableGroupChange,
  Order,
  OrderTable,
  OrderDetail,
  KitchenTicket,
  InventoryMovement,
  EmailVerification,
  LoginAttempt,
  LoginLock,
  UserStatusChange,
  DishStatusChange,
  WaiterNotification,
};
