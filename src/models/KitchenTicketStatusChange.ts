import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from "sequelize";
import { sequelize } from "../config/database";

export class KitchenTicketStatusChange extends Model<
  InferAttributes<KitchenTicketStatusChange>,
  InferCreationAttributes<KitchenTicketStatusChange>
> {
  declare id: CreationOptional<number>;
  declare kitchen_ticket_id: ForeignKey<number>;
  declare previous_status: string;
  declare new_status: string;
  declare changed_by: ForeignKey<number>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

KitchenTicketStatusChange.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    kitchen_ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previous_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    new_status: {
      type: DataTypes.STRING(32),
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
    tableName: "kitchen_ticket_status_changes",
    modelName: "KitchenTicketStatusChange",
  }
);
