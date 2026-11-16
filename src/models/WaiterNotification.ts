import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class WaiterNotification extends Model<
  InferAttributes<WaiterNotification>,
  InferCreationAttributes<WaiterNotification>
> {
  declare id: CreationOptional<number>;
  declare kitchen_ticket_id: ForeignKey<number>;
  declare order_id: ForeignKey<number>;
  declare order_detail_id: ForeignKey<number | null>;
  declare waiter_id: ForeignKey<number>;
  declare order_code: string;
  declare table_label: string;
  declare dish_label: CreationOptional<string | null>;
  declare ticket_ready_at: Date;
  declare attended_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

WaiterNotification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    kitchen_ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_detail_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    waiter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    table_label: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    dish_label: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    ticket_ready_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "waiter_notifications",
    modelName: "WaiterNotification",
    indexes: [
      {
        unique: true,
        fields: ["kitchen_ticket_id", "ticket_ready_at"],
        name: "waiter_notifications_ticket_ready_unique",
      },
    ],
  }
);
