import dotenv from "dotenv";

dotenv.config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;

const parseDatabaseUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    name: parsed.pathname.replace(/^\//, ""),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
};

const fromUrl = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: fromUrl?.host || process.env.DB_HOST || "localhost",
    port: fromUrl?.port || Number(process.env.DB_PORT) || 5432,
    name: fromUrl?.name || process.env.DB_NAME || "gran_parrillada_timbo",
    user: fromUrl?.user || process.env.DB_USER || "postgres",
    password: fromUrl?.password || process.env.DB_PASSWORD || "postgres",
    dialect: (process.env.DB_DIALECT || "postgres") as "postgres",
    ssl: process.env.DB_SSL === "true",
    sync: process.env.DB_SYNC === "true",
    logging: process.env.DB_LOGGING === "true",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_change_me",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: (process.env.SMTP_PASS || "").replace(/\s/g, ""),
    from: process.env.SMTP_FROM || "",
  },
};
