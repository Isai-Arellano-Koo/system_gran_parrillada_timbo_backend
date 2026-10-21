import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "../config/database";

export class LoginLock extends Model<
  InferAttributes<LoginLock>,
  InferCreationAttributes<LoginLock>
> {
  declare id: CreationOptional<number>;
  declare lock_key: string;
  declare identifier: string;
  declare user_id: CreationOptional<number | null>;
  declare fail_count: CreationOptional<number>;
  declare locked_until: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

LoginLock.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    lock_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    identifier: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fail_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "login_locks",
    modelName: "LoginLock",
  }
);
