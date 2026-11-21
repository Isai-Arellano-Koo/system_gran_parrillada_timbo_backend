import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class OrderCancellation extends Model<
  InferAttributes<OrderCancellation>,
  InferCreationAttributes<OrderCancellation>
> {
  declare id: CreationOptional<number>;
  declare order_id: ForeignKey<number>;
  declare previous_status: string;
  declare previous_kitchen_status: CreationOptional<string | null>;
  declare stock_action: CreationOptional<string>;
  declare reason: string;
  declare cancelled_by: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

OrderCancellation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    previous_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    previous_kitchen_status: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    stock_action: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "none",
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cancelled_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "order_cancellations",
    modelName: "OrderCancellation",
  }
);
