import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";
import type { OrderStatus } from "../types/enums";

export class Order extends Model<
  InferAttributes<Order>,
  InferCreationAttributes<Order>
> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare table_id: ForeignKey<number>;
  declare waiter_id: ForeignKey<number>;
  declare status: CreationOptional<OrderStatus>;
  declare total: CreationOptional<number>;
  declare cancel_reason: CreationOptional<string | null>;
  declare confirmed_at: CreationOptional<Date | null>;
  declare cancelled_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    table_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    waiter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("en_edicion", "confirmado", "cancelado"),
      allowNull: false,
      defaultValue: "en_edicion",
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cancel_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "orders",
    modelName: "Order",
  }
);
