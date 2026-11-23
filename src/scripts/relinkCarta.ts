import dotenv from "dotenv";

dotenv.config();

import { sequelize } from "../config/database";
import { relinkCartaCatalog } from "../helpers/relinkCartaCatalog";
import "../models";

const run = async () => {
  await sequelize.authenticate();
  await relinkCartaCatalog();
  const [rows] = await sequelize.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(category_id)::int AS with_category,
      COUNT(*) FILTER (WHERE category_id IS NULL)::int AS without_category
    FROM dishes
  `);
  console.log(rows);
  await sequelize.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
