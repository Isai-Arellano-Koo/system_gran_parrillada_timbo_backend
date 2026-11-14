import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class TableGroupMember extends Model<
  InferAttributes<TableGroupMember>,
  InferCreationAttributes<TableGroupMember>
> {
  declare id: CreationOptional<number>;
  declare group_id: ForeignKey<number>;
  declare table_id: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

TableGroupMember.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    table_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "table_group_members",
    modelName: "TableGroupMember",
  }
);
