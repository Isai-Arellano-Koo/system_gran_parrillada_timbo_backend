import dotenv from "dotenv";

dotenv.config();

import { sequelize } from "../config/database";
import "../models";

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true }); // script aparte para acomodar tablas, no corre al iniciar
    console.log("Sincronización finalizada.");
    process.exit(0);
  } catch (error) {
    console.error("Error al sincronizar la base de datos:", error);
    process.exit(1);
  }
};

run();
