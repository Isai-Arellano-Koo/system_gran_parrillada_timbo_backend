import { Sequelize } from "sequelize";
import { env } from "./env";

export const sequelize = new Sequelize(
  env.db.name,
  env.db.user,
  env.db.password,
  {
    host: env.db.host,
    port: env.db.port,
    dialect: env.db.dialect,
    logging: env.db.logging ? console.log : false,
    dialectOptions: env.db.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

export const connectDatabase = async () => {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL establecida correctamente.");

  if (env.db.sync) {
    await sequelize.sync({ alter: true });
    console.log("Modelos sincronizados con la base de datos.");
  }
};
