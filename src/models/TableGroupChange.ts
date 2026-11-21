import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class TableGroupChange extends Model<
  InferAttributes<TableGroupChange>,
  InferCreationAttributes<TableGroupChange>
> {
  declare id: CreationOptional<number>;
  declare group_id: ForeignKey<number | null>;
  declare action: "agrupar" | "desagrupar";
  declare table_ids: string;
  declare changed_by: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

TableGroupChange.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    group_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    table_ids: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "table_group_changes",
    modelName: "TableGroupChange",
  }
);
