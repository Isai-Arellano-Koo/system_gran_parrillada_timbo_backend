import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class OrderDetail extends Model<
  InferAttributes<OrderDetail>,
  InferCreationAttributes<OrderDetail>
> {
  declare id: CreationOptional<number>;
  declare order_id: ForeignKey<number>;
  declare dish_id: ForeignKey<number>;
  declare quantity: number;
  declare unit_price: number;
  declare observation: CreationOptional<string | null>;
  declare sent_to_kitchen: CreationOptional<boolean>;
  declare kitchen_status: CreationOptional<
    "pendiente" | "en_preparacion" | "listo" | "entregado"
  >;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

OrderDetail.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dish_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    observation: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sent_to_kitchen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    kitchen_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pendiente",
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "order_details",
    modelName: "OrderDetail",
  }
);
