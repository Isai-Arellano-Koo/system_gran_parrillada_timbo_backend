import { QueryTypes, Sequelize } from "sequelize";
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

const ensureUserRoleValues = async () => {
  const rows = await sequelize.query<{ typname: string }>(
    `SELECT t.typname AS typname
     FROM pg_type t
     JOIN pg_attribute a ON a.atttypid = t.oid
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'users'
       AND a.attname = 'role'
       AND t.typtype = 'e'
       AND n.nspname = 'public'`,
    { type: QueryTypes.SELECT }
  );
  const typname = rows[0]?.typname;
  if (!typname || !/^[a-zA-Z0-9_]+$/.test(typname)) return;
  await sequelize.query(
    `ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS 'cajero'`
  );
};

export const connectDatabase = async () => {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL establecida correctamente.");
  await ensureUserRoleValues();

  if (env.db.sync) {
    // Creates missing tables. alter:true on every boot duplicated unique indexes.
    await sequelize.sync();
    console.log("Modelos sincronizados con la base de datos.");
  }

  await sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`
  );
};
