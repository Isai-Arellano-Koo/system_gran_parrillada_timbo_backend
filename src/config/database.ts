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
    dialectOptions: env.db.ssl // Railway pide SSL
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

const ensureEnumValue = async (
  table: string,
  column: string,
  value: string
) => {
  const rows = await sequelize.query<{ typname: string }>(
    `SELECT t.typname AS typname
     FROM pg_type t
     JOIN pg_attribute a ON a.atttypid = t.oid
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = :table
       AND a.attname = :column
       AND t.typtype = 'e'
       AND n.nspname = 'public'`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  const typname = rows[0]?.typname;
  if (!typname || !/^[a-zA-Z0-9_]+$/.test(typname)) return;
  await sequelize.query(
    `ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS '${value}'`
  );
};

export const connectDatabase = async () => {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL establecida correctamente.");

  if (env.db.sync) {
    // Crea tablas que falten. No usamos alter:true porque duplicaba índices
    await sequelize.sync();
    console.log("Modelos sincronizados con la base de datos.");
  }

  await ensureEnumValue("users", "role", "cajero");
  await ensureEnumValue("orders", "status", "cerrado");
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0`
  );
  await sequelize.query(
    `ALTER TABLE order_details ADD COLUMN IF NOT EXISTS sent_to_kitchen BOOLEAN NOT NULL DEFAULT false`
  );
  await sequelize.query(
    `ALTER TABLE order_details ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(32) NOT NULL DEFAULT 'pendiente'`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS modality VARCHAR(16) NOT NULL DEFAULT 'mesa'`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE`
  );
  await sequelize.query(
    `ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_customer_name VARCHAR(120)`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(40)`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(255)`
  );
  await sequelize.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT`
  );
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS order_tables (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      UNIQUE (order_id, table_id)
    )
  `);
  await sequelize.query(`
    INSERT INTO order_tables (order_id, table_id, created_at, updated_at)
    SELECT o.id, o.table_id, NOW(), NOW()
    FROM orders o
    WHERE o.table_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_tables ot
        WHERE ot.order_id = o.id AND ot.table_id = o.table_id
      )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS table_groups (
      id SERIAL PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS table_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES table_groups(id) ON DELETE CASCADE,
      table_id INTEGER NOT NULL UNIQUE REFERENCES tables(id),
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS table_status_changes (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      previous_is_active BOOLEAN NOT NULL,
      next_is_active BOOLEAN NOT NULL,
      reason VARCHAR(255) NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS table_group_changes (
      id SERIAL PRIMARY KEY,
      group_id INTEGER,
      action VARCHAR(20) NOT NULL,
      table_ids VARCHAR(255) NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
  `);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS waiter_notifications (
      id SERIAL PRIMARY KEY,
      kitchen_ticket_id INTEGER NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      waiter_id INTEGER NOT NULL REFERENCES users(id),
      order_code VARCHAR(40) NOT NULL,
      table_label VARCHAR(80) NOT NULL,
      ticket_ready_at TIMESTAMP WITH TIME ZONE NOT NULL,
      attended_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE,
      UNIQUE (kitchen_ticket_id, ticket_ready_at)
    )
  `);
  await sequelize.query(
    `ALTER TABLE waiter_notifications ADD COLUMN IF NOT EXISTS order_detail_id INTEGER`
  );
  await sequelize.query(
    `ALTER TABLE waiter_notifications ADD COLUMN IF NOT EXISTS dish_label VARCHAR(160)`
  );
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS waiter_notifications_detail_unique
    ON waiter_notifications (order_detail_id)
    WHERE order_detail_id IS NOT NULL
  `);
  await sequelize.query(`
    UPDATE order_details d
    SET sent_to_kitchen = true
    FROM orders o
    WHERE d.order_id = o.id
      AND d.sent_to_kitchen = false
      AND o.status IN ('confirmado', 'cerrado', 'cancelado')
  `);

  await sequelize.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`
  );
  await sequelize.query(
    `ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS purpose VARCHAR(32) NOT NULL DEFAULT 'confirm-email'`
  );

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
  `);
  await sequelize.query(
    `ALTER TABLE dishes ADD COLUMN IF NOT EXISTS presentation VARCHAR(80) NOT NULL DEFAULT ''`
  );
  await sequelize.query(
    `ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category_disabled BOOLEAN NOT NULL DEFAULT false`
  );
  await sequelize.query(
    `ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category_id INTEGER`
  );
  await sequelize.query(
    `ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_name_key`
  );
  await sequelize.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM dishes WHERE category_id IS NULL
      ) THEN
        ALTER TABLE dishes
          ADD CONSTRAINT dishes_category_id_fkey
          FOREIGN KEY (category_id) REFERENCES categories(id);
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END $$
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS dishes_name_presentation_unique
    ON dishes (name, presentation)
  `);
};
