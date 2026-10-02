import { sequelize } from "../../config/database";

export const getHealthStatus = async () => {
  await sequelize.query("SELECT 1");

  return {
    status: "ok",
    service: "gran-parrillada-timbo-backend",
    database: "connected",
    orm: "sequelize",
    timestamp: new Date().toISOString(),
  };
};
