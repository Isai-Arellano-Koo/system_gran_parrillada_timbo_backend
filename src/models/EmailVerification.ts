import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "../config/database";

export class EmailVerification extends Model<
  InferAttributes<EmailVerification>,
  InferCreationAttributes<EmailVerification>
> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare code_hash: string;
  declare expires_at: Date;
  declare used_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

EmailVerification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "email_verifications",
    modelName: "EmailVerification",
  }
);
