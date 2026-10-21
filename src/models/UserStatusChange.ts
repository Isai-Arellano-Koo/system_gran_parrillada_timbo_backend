import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class UserStatusChange extends Model<
  InferAttributes<UserStatusChange>,
  InferCreationAttributes<UserStatusChange>
> {
  declare id: CreationOptional<number>;
  declare user_id: ForeignKey<number>;
  declare previous_is_active: boolean;
  declare next_is_active: boolean;
  declare reason: string;
  declare changed_by: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

UserStatusChange.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previous_is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    next_is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    reason: {
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
    tableName: "user_status_changes",
    modelName: "UserStatusChange",
  }
);
