import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";
import type { InventoryMovementType } from "../types/enums";

export class InventoryMovement extends Model<
  InferAttributes<InventoryMovement>,
  InferCreationAttributes<InventoryMovement>
> {
  declare id: CreationOptional<number>;
  declare ingredient_id: ForeignKey<number>;
  declare type: InventoryMovementType;
  declare quantity: number;
  declare reason: CreationOptional<string | null>;
  declare order_id: CreationOptional<number | null>;
  declare user_id: ForeignKey<number>;
  declare merma_review: CreationOptional<string | null>;
  declare reviewed_by: CreationOptional<ForeignKey<number> | null>;
  declare reviewed_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

InventoryMovement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ingredient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        "entrada",
        "salida_venta",
        "devolucion",
        "ajuste",
        "merma"
      ),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    merma_review: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "inventory_movements",
    modelName: "InventoryMovement",
  }
);
