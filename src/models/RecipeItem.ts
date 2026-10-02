import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class RecipeItem extends Model<
  InferAttributes<RecipeItem>,
  InferCreationAttributes<RecipeItem>
> {
  declare id: CreationOptional<number>;
  declare dish_id: ForeignKey<number>;
  declare ingredient_id: ForeignKey<number>;
  declare quantity: number;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

RecipeItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    dish_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ingredient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "recipe_items",
    modelName: "RecipeItem",
    indexes: [
      {
        unique: true,
        fields: ["dish_id", "ingredient_id"],
      },
    ],
  }
);
