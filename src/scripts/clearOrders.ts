import dotenv from "dotenv";

dotenv.config();

import { QueryTypes } from "sequelize";
import { connectDatabase, sequelize } from "../config/database";
import "../models";

const run = async () => {
  await connectDatabase();
  await sequelize.transaction(async (t) => {
    await sequelize.query(
      `UPDATE inventory_movements SET order_id = NULL WHERE order_id IS NOT NULL`,
      { transaction: t }
    );
    await sequelize.query(`DELETE FROM waiter_notifications`, { transaction: t });
    await sequelize.query(`DELETE FROM kitchen_tickets`, { transaction: t });
    await sequelize.query(`DELETE FROM order_details`, { transaction: t });
    await sequelize.query(`DELETE FROM order_tables`, { transaction: t });
    await sequelize.query(`DELETE FROM orders`, { transaction: t });
  });

  const orders = await sequelize.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders`,
    { type: QueryTypes.SELECT }
  );
  const occupied = await sequelize.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM order_tables ot
     JOIN orders o ON o.id = ot.order_id
     WHERE o.status IN ('en_edicion', 'confirmado')`,
    { type: QueryTypes.SELECT }
  );
  console.log(
    `Pedidos restantes: ${orders[0]?.n ?? 0}. Mesas ocupadas: ${occupied[0]?.n ?? 0}.`
  );
  await sequelize.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
