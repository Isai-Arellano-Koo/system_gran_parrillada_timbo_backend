import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class Dish extends Model<
  InferAttributes<Dish>,
  InferCreationAttributes<Dish>
> {
  declare id: CreationOptional<number>;
  declare category_id: ForeignKey<number>;
  declare name: string;
  declare presentation: CreationOptional<string>;
  declare price: number;
  declare description: CreationOptional<string | null>;
  declare is_active: CreationOptional<boolean>;
  declare category_disabled: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Dish.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    presentation: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    category_disabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "dishes",
    modelName: "Dish",
    indexes: [
      {
        unique: true,
        fields: ["name", "presentation"],
        name: "dishes_name_presentation_unique",
      },
    ],
  }
);
