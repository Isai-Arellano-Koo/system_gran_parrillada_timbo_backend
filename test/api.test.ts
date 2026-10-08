import type { Server } from "node:http";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, it } from "vitest";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.test", quiet: true });

const TEST_PORT = Number(process.env.TEST_PORT || 3099);

type ApiResult = {
  status: number;
  data: {
    message?: string;
    accessToken?: string;
    user?: {
      id: number;
      name: string;
      username?: string | null;
      email: string;
      role: string;
      is_active?: boolean;
    };
    stock_current?: number | string;
    ingredient?: { stock_current?: number | string };
  } & Record<string, unknown>;
};

const appDatabaseUrl = process.env.DATABASE_URL || "";
const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";

const sameDatabase = (left: string, right: string) => {
  const a = new URL(left);
  const b = new URL(right);
  return a.host === b.host && a.pathname === b.pathname;
};

const useTestDatabase = () => {
  if (!testDatabaseUrl) {
    throw new Error(
      "Falta TEST_DATABASE_URL. Defínela en backend_gran_parrillada_timbo/.env.test"
    );
  }
  if (appDatabaseUrl && sameDatabase(appDatabaseUrl, testDatabaseUrl)) {
    throw new Error(
      "TEST_DATABASE_URL apunta a la misma base que DATABASE_URL. Las pruebas no pueden usar la base de la aplicación."
    );
  }

  const parsed = new URL(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DB_HOST = parsed.hostname;
  process.env.DB_PORT = parsed.port || "5432";
  process.env.DB_NAME = parsed.pathname.replace(/^\//, "");
  process.env.DB_USER = decodeURIComponent(parsed.username);
  process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
  process.env.DB_SSL = parsed.hostname === "localhost" ? "false" : "true";
  process.env.DB_SYNC = "false";
  process.env.NODE_ENV = "test";
  return `${parsed.hostname}/${process.env.DB_NAME}`;
};

const prepareSchemaAndSeed = async () => {

  const { sequelize } = await import("../src/config/database");
  const { User, Table } = await import("../src/models/index");
  const { hashPassword } = await import("../src/helpers/password");

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const users = [
    {
      name: "Administrador",
      username: "admin",
      email: "admin@timbo.com",
      password: "admin123",
      role: "admin" as const,
    },
    {
      name: "Mesero Demo",
      username: "mesero",
      email: "mesero@timbo.com",
      password: "mesero123",
      role: "mesero" as const,
    },
    {
      name: "Cocinero Demo",
      username: "cocinero",
      email: "cocinero@timbo.com",
      password: "cocinero123",
      role: "cocinero" as const,
    },
  ];

  for (const item of users) {
    await User.create({
      name: item.name,
      username: item.username,
      email: item.email,
      password_hash: await hashPassword(item.password),
      role: item.role,
    });
  }

  await Table.bulkCreate(
    Array.from({ length: 30 }, (_, index) => ({
      number: index + 1,
      capacity: 4,
      is_active: true,
    }))
  );

  return sequelize;
};

const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

const request = async (
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {}
): Promise<ApiResult> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = (await response.json().catch(() => ({}))) as ApiResult["data"];
  return { status: response.status, data };
};

const messageOf = (result: ApiResult) => String(result.data.message || "");

const check = (condition: unknown, detail: string) => {
  if (!condition) throw new Error(detail);
};

useTestDatabase();

let sequelize: { close: () => Promise<void> };
let server: Server;
let adminToken = "";
let meseroToken = "";
let adminId = 0;
let meseroId = 0;
let ingredientId = 0;

describe("API Gran Parrillada Timbó", () => {
  beforeAll(async () => {
    sequelize = await prepareSchemaAndSeed();
    const { default: app } = await import("../src/app");
    server = app.listen(TEST_PORT);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });
    const meseroLogin = await request("POST", "/api/auth/login", {
      body: { email: "mesero@timbo.com", password: "mesero123" },
    });
    meseroToken = meseroLogin.data.accessToken || "";
    meseroId = meseroLogin.data.user?.id || 0;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (sequelize) await sequelize.close();
  });

    it("CP01 Login válido con email", async () => {
      const result = await request("POST", "/api/auth/login", {
        body: { email: "admin@timbo.com", password: "admin123" },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.accessToken, "No devolvió accessToken");
      check(result.data.user?.email === "admin@timbo.com", "El usuario no es el admin");
      adminToken = result.data.accessToken || "";
      adminId = result.data.user?.id || 0;
    });

    it("CP02 Login con nombre de usuario", async () => {
      const result = await request("POST", "/api/auth/login", {
        body: { username: "admin", password: "admin123" },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.accessToken, "No devolvió accessToken");
      check(result.data.user?.username === "admin", "El usuario no es admin");
    });

    it("CP03 Login con contraseña incorrecta", async () => {
      const result = await request("POST", "/api/auth/login", {
        body: { email: "admin@timbo.com", password: "mala" },
      });
      check(result.status === 401, `Estado ${result.status}`);
      check(messageOf(result).includes("Credenciales inválidas"), messageOf(result));
    });

    it("CP04 Login con body vacío", async () => {
      const result = await request("POST", "/api/auth/login", { body: {} });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("obligatorios"), messageOf(result));
    });

    it("CP05 Consultar sesión con token", async () => {
      const result = await request("GET", "/api/auth/me", { token: adminToken });
      check(result.status === 200, `Estado ${result.status}`);
      check(result.data.role === "admin", "El rol no es admin");
      check(result.data.email === "admin@timbo.com", "Email inesperado");
    });

    it("CP06 Consultar sesión sin token", async () => {
      const result = await request("GET", "/api/auth/me");
      check(result.status === 401, `Estado ${result.status}`);
      check(messageOf(result).includes("falta token"), messageOf(result));
    });

    it("CP07 Admin registra un mesero válido", async () => {
      const codeResult = await request("POST", "/api/users/email-code", {
        token: adminToken,
        body: { email: "luis.test@timbo.com" },
      });
      check(codeResult.status === 200, `Estado ${codeResult.status}: ${messageOf(codeResult)}`);
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Luis Test",
          username: "luis.test",
          email: "luis.test@timbo.com",
          password: "clave1234",
          role: "mesero",
          is_active: true,
          verification_code: String(codeResult.data.devCode || ""),
        },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.role === "mesero", "El rol creado no es mesero");
    });

    it("CP08 Username ya existente", async () => {
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Otro Luis",
          username: "luis.test",
          email: "otro.luis@timbo.com",
          password: "clave1234",
          role: "mesero",
        },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("nombre de usuario"), messageOf(result));
    });

    it("CP09 Email ya existente", async () => {
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Otro correo",
          username: "otro.correo",
          email: "luis.test@timbo.com",
          password: "clave1234",
          role: "cocinero",
        },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("correo"), messageOf(result));
    });

    it("CP10 Registrar rol cajero", async () => {
      const codeResult = await request("POST", "/api/users/email-code", {
        token: adminToken,
        body: { email: "cajero.test@timbo.com" },
      });
      check(codeResult.status === 200, `Estado ${codeResult.status}: ${messageOf(codeResult)}`);
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Cajero Test",
          username: "cajero.test",
          email: "cajero.test@timbo.com",
          password: "clave1234",
          role: "cajero",
          verification_code: String(codeResult.data.devCode || ""),
        },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.role === "cajero", "El rol creado no es cajero");
    });

    it("CP11 Contraseña corta", async () => {
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Clave Corta",
          username: "clave.corta",
          email: "clave.corta@timbo.com",
          password: "123",
          role: "mesero",
        },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("8 caracteres"), messageOf(result));
    });

    it("CP12 Registrar sin token", async () => {
      const result = await request("POST", "/api/users", {
        body: {
          name: "Sin Token",
          username: "sin.token",
          email: "sin.token@timbo.com",
          password: "clave1234",
          role: "mesero",
        },
      });
      check(result.status === 401, `Estado ${result.status}`);
      check(messageOf(result).includes("falta token"), messageOf(result));
    });

    it("CP13 Mesero intenta registrar usuarios", async () => {
      const result = await request("POST", "/api/users", {
        token: meseroToken,
        body: {
          name: "Intruso",
          username: "intruso",
          email: "intruso@timbo.com",
          password: "clave1234",
          role: "mesero",
        },
      });
      check(result.status === 403, `Estado ${result.status}: ${messageOf(result)}`);
    });

    it("CP14 Admin no puede cambiar su propio rol", async () => {
      const result = await request("PATCH", `/api/users/${adminId}`, {
        token: adminToken,
        body: { role: "mesero" },
      });
      check(result.status === 400, `Estado ${result.status}: ${messageOf(result)}`);
      check(messageOf(result).includes("propio rol"), messageOf(result));
    });

    it("CP15 Admin no puede desactivarse", async () => {
      const result = await request("PATCH", `/api/users/${adminId}`, {
        token: adminToken,
        body: { is_active: false },
      });
      check(result.status === 400, `Estado ${result.status}: ${messageOf(result)}`);
      check(messageOf(result).includes("propia cuenta"), messageOf(result));
    });

    it("CP16 Admin desactiva a otro usuario", async () => {
      const result = await request("PATCH", `/api/users/${meseroId}`, {
        token: adminToken,
        body: { is_active: false },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.is_active === false, "El usuario sigue activo");
    });

    it("CP17 Crear ingrediente válido", async () => {
      const result = await request("POST", "/api/catalog/ingredients", {
        token: adminToken,
        body: { name: "Bife de chorizo", unit: "kg", stock_minimum: 5 },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      check(Number(result.data.stock_current) === 0, "El stock inicial no es 0");
      ingredientId = Number(result.data.id);
    });

    it("CP18 Ingrediente con nombre duplicado", async () => {
      const result = await request("POST", "/api/catalog/ingredients", {
        token: adminToken,
        body: { name: "Bife de chorizo", unit: "kg", stock_minimum: 1 },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("nombre"), messageOf(result));
    });

    it("CP19 Unidad inválida", async () => {
      const result = await request("POST", "/api/catalog/ingredients", {
        token: adminToken,
        body: { name: "Carbón", unit: "bolsas", stock_minimum: 1 },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("unidad"), messageOf(result));
    });

    it("CP20 Ingrediente sin nombre", async () => {
      const result = await request("POST", "/api/catalog/ingredients", {
        token: adminToken,
        body: { unit: "kg" },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("nombre es obligatorio"), messageOf(result));
    });

    it("CP21 Mesero no puede crear ingredientes", async () => {
      const result = await request("POST", "/api/catalog/ingredients", {
        token: meseroToken,
        body: { name: "Sal", unit: "kg" },
      });
      check(result.status === 403, `Estado ${result.status}: ${messageOf(result)}`);
    });

    it("CP22 Mesero puede listar ingredientes", async () => {
      const result = await request("GET", "/api/catalog/ingredients", {
        token: meseroToken,
      });
      check(result.status === 200, `Estado ${result.status}`);
      check(Array.isArray(result.data), "La respuesta no es una lista");
    });

    it("CP23 Entrada de stock válida", async () => {
      const result = await request("POST", "/api/inventory/entries", {
        token: adminToken,
        body: {
          ingredient_id: ingredientId,
          quantity: 10,
          reason: "Compra de prueba",
        },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      const stock = Number(
        result.data.ingredient?.stock_current ?? result.data.stock_current
      );
      check(stock === 10, `Stock resultante ${stock}`);
    });

    it("CP24 Entrada con cantidad cero", async () => {
      const result = await request("POST", "/api/inventory/entries", {
        token: adminToken,
        body: { ingredient_id: ingredientId, quantity: 0, reason: "Cero" },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("mayor que cero"), messageOf(result));
    });

    it("CP25 Entrada con cantidad negativa", async () => {
      const result = await request("POST", "/api/inventory/entries", {
        token: adminToken,
        body: { ingredient_id: ingredientId, quantity: -5, reason: "Negativa" },
      });
      check(result.status === 400, `Estado ${result.status}`);
      check(messageOf(result).includes("mayor que cero"), messageOf(result));
    });

    it("CP26 Entrada de ingrediente inexistente", async () => {
      const result = await request("POST", "/api/inventory/entries", {
        token: adminToken,
        body: { ingredient_id: 9999, quantity: 1, reason: "No existe" },
      });
      check(result.status === 404, `Estado ${result.status}: ${messageOf(result)}`);
    });

    it("CP27 Mesero no puede registrar entradas", async () => {
      const result = await request("POST", "/api/inventory/entries", {
        token: meseroToken,
        body: { ingredient_id: ingredientId, quantity: 1, reason: "Mesero" },
      });
      check(result.status === 403, `Estado ${result.status}: ${messageOf(result)}`);
    });

    it("CP28 Listar movimientos", async () => {
      const result = await request("GET", "/api/inventory/movements", {
        token: adminToken,
      });
      check(result.status === 200, `Estado ${result.status}`);
      const movements = result.data as unknown as Array<{
        type: string;
        ingredient?: { name?: string };
        user?: { name?: string };
      }>;
      check(Array.isArray(movements), "La respuesta no es una lista");
      const entry = movements.find((item) => item.type === "entrada");
      check(entry, "No aparece la entrada del CP23");
      check(entry?.ingredient?.name === "Bife de chorizo", "Falta el ingrediente");
      check(entry?.user?.name, "Falta el usuario");
    });

    it("CP29 Listar alertas de stock mínimo", async () => {
      const result = await request("GET", "/api/inventory/alerts", {
        token: adminToken,
      });
      check(result.status === 200, `Estado ${result.status}`);
      const alerts = result.data as unknown as unknown[];
      check(Array.isArray(alerts), "La respuesta no es una lista");
      check(alerts.length === 0, `Se esperaba lista vacía y hay ${alerts.length}`);
    });
});
