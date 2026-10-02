import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";
import type { KitchenStatus } from "../types/enums";

export class KitchenTicket extends Model<
  InferAttributes<KitchenTicket>,
  InferCreationAttributes<KitchenTicket>
> {
  declare id: CreationOptional<number>;
  declare order_id: ForeignKey<number>;
  declare status: CreationOptional<KitchenStatus>;
  declare status_changed_by: CreationOptional<number | null>;
  declare status_changed_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KitchenTicket.init(
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
    status: {
      type: DataTypes.ENUM(
        "pendiente",
        "en_preparacion",
        "listo",
        "entregado"
      ),
      allowNull: false,
      defaultValue: "pendiente",
    },
    status_changed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "kitchen_tickets",
    modelName: "KitchenTicket",
  }
);
