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
let pendingCode = "";
let pendingToken = "";

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
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Luis Test",
          username: "luis.test",
          email: "luis.test@timbo.com",
          password: "clave1234",
          role: "mesero",
          is_active: true,
        },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.role === "mesero", "El rol creado no es mesero");
      check(result.data.is_active === false, "La cuenta nueva no quedó deshabilitada");
      check(result.data.email_verified === false, "El correo quedó confirmado al crearla");
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
      const result = await request("POST", "/api/users", {
        token: adminToken,
        body: {
          name: "Cajero Test",
          username: "cajero.test",
          email: "cajero.test@timbo.com",
          password: "clave1234",
          role: "cajero",
        },
      });
      check(result.status === 201, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.role === "cajero", "El rol creado no es cajero");
      check(result.data.is_active === false, "La cuenta nueva no quedó deshabilitada");
    });

    it("CP30 Primer ingreso pide confirmar el correo", async () => {
      const result = await request("POST", "/api/auth/login", {
        body: { username: "cajero.test", password: "clave1234" },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.needsEmailConfirmation === true, "No pidió confirmar el correo");
      check(!result.data.accessToken, "Entregó acceso antes de confirmar");
      check(Boolean(result.data.devCode), "No devolvió el código de prueba");
      check(Boolean(result.data.confirmationToken), "No devolvió el token de confirmación");
      pendingCode = String(result.data.devCode);
      pendingToken = String(result.data.confirmationToken);
    });

    it("CP31 Código incorrecto no activa la cuenta", async () => {
      const result = await request("POST", "/api/auth/confirm-email", {
        body: {
          confirmationToken: pendingToken,
          code: "000000",
        },
      });
      check(result.status === 400, `Estado ${result.status}: ${messageOf(result)}`);
    });

    it("CP32 Confirmar el correo activa la cuenta", async () => {
      const result = await request("POST", "/api/auth/confirm-email", {
        body: {
          confirmationToken: pendingToken,
          code: pendingCode,
        },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(Boolean(result.data.accessToken), "No entregó accessToken");
      check(result.data.user?.role === "cajero", "El rol después de confirmar no es cajero");
      check(result.data.user?.is_active !== false, "La cuenta sigue deshabilitada");

      const again = await request("POST", "/api/auth/login", {
        body: { username: "cajero.test", password: "clave1234" },
      });
      check(again.status === 200, `Estado ${again.status}: ${messageOf(again)}`);
      check(Boolean(again.data.accessToken), "El segundo ingreso no entregó acceso");
      check(again.data.needsEmailConfirmation !== true, "Volvió a pedir confirmación");
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
      const missing = await request("PATCH", `/api/users/${meseroId}`, {
        token: adminToken,
        body: { is_active: false },
      });
      check(missing.status === 400, `Estado ${missing.status}: ${messageOf(missing)}`);
      check(messageOf(missing).includes("motivo"), messageOf(missing));

      const result = await request("PATCH", `/api/users/${meseroId}`, {
        token: adminToken,
        body: {
          is_active: false,
          status_reason: "Prueba de suspensión para el sprint 2",
        },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.is_active === false, "El usuario sigue activo");

      const history = await request("GET", `/api/users/${meseroId}/status-changes`, {
        token: adminToken,
      });
      check(history.status === 200, `Estado ${history.status}: ${messageOf(history)}`);
      const rows = history.data as unknown as Array<{
        previous_is_active: boolean;
        next_is_active: boolean;
        reason: string;
        changed_by_user?: { id: number; name: string };
      }>;
      check(Array.isArray(rows) && rows.length >= 1, "No se guardó el cambio de estado");
      check(rows[0].previous_is_active === true, "No quedó el estado anterior");
      check(rows[0].next_is_active === false, "No quedó el estado nuevo");
      check(rows[0].reason.includes("Prueba de suspensión"), "No quedó el motivo");
      check(rows[0].changed_by_user?.id === adminId, "No quedó el administrador");
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

    it("CP28b Filtrar movimientos por tipo", async () => {
      const result = await request(
        "GET",
        "/api/inventory/movements?type=entrada",
        { token: adminToken }
      );
      check(result.status === 200, `Estado ${result.status}`);
      const movements = result.data as unknown as Array<{ type: string }>;
      check(Array.isArray(movements), "La respuesta no es una lista");
      check(
        movements.length > 0 && movements.every((item) => item.type === "entrada"),
        "El filtro por tipo no devolvió solo entradas"
      );
    });

    it("CP28c Un movimiento no se elimina", async () => {
      const listed = await request("GET", "/api/inventory/movements", {
        token: adminToken,
      });
      const movements = listed.data as unknown as Array<{ id: number }>;
      const id = movements[0]?.id;
      check(id, "No hay movimiento para intentar borrar");
      const result = await request("DELETE", `/api/inventory/movements/${id}`, {
        token: adminToken,
      });
      check(result.status === 409, `Estado ${result.status}: ${messageOf(result)}`);
      check(messageOf(result).toLowerCase().includes("elimina"), messageOf(result));
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

    it("CP33 Cinco claves malas bloquean la cuenta", async () => {
      let last = { status: 0, data: {} as ApiResult["data"] };
      for (let i = 0; i < 5; i += 1) {
        last = await request("POST", "/api/auth/login", {
          body: { username: "cocinero", password: "clave-mala" },
        });
      }
      check(last.status === 429, `Estado ${last.status}: ${messageOf(last)}`);
      check(last.data.locked === true, "No marcó la cuenta como bloqueada");
      check(Boolean(last.data.lockedUntil), "No devolvió hasta cuándo dura el bloqueo");
    });

    it("CP34 Con el bloqueo activo no entra ni con la clave buena", async () => {
      const result = await request("POST", "/api/auth/login", {
        body: { username: "cocinero", password: "cocinero123" },
      });
      check(result.status === 429, `Estado ${result.status}: ${messageOf(result)}`);
      check(result.data.locked === true, "Debió mantener el bloqueo");
    });

    it("CP35 Los intentos de login quedan registrados", async () => {
      const { LoginAttempt } = await import("../src/models");
      const fails = await LoginAttempt.count({
        where: { identifier: "cocinero", success: false },
      });
      check(fails >= 5, `Solo hay ${fails} intentos fallidos registrados`);
    });

    it("CP36 Restablecer contraseña con código levanta el bloqueo", async () => {
      const asked = await request("POST", "/api/auth/password-reset", {
        body: { username: "cocinero" },
      });
      check(asked.status === 200, `Estado ${asked.status}: ${messageOf(asked)}`);
      check(Boolean(asked.data.devCode), "No devolvió el código de prueba");

      const wrong = await request("POST", "/api/auth/password-reset/confirm", {
        body: {
          username: "cocinero",
          code: "000000",
          password: "nueva1234",
        },
      });
      check(wrong.status === 400, `Estado ${wrong.status}`);

      const changed = await request("POST", "/api/auth/password-reset/confirm", {
        body: {
          username: "cocinero",
          code: String(asked.data.devCode),
          password: "nueva1234",
        },
      });
      check(changed.status === 200, `Estado ${changed.status}: ${messageOf(changed)}`);

      const login = await request("POST", "/api/auth/login", {
        body: { username: "cocinero", password: "nueva1234" },
      });
      check(login.status === 200, `Estado ${login.status}: ${messageOf(login)}`);
      check(Boolean(login.data.accessToken), "No entregó acceso después del reset");
    });

    it("CP37 Al vencer el bloqueo se puede entrar", async () => {
      const { User, LoginLock } = await import("../src/models");
      const { hashPassword } = await import("../src/helpers/password");
      const { lockKeyFor } = await import("../src/helpers/loginLock");

      const lockedUser = await User.create({
        name: "Bloqueo Temporal",
        username: "bloqueo.temp",
        email: "bloqueo.temp@timbo.com",
        password_hash: await hashPassword("clave1234"),
        role: "mesero",
      });

      let last = { status: 0, data: {} as ApiResult["data"] };
      for (let i = 0; i < 5; i += 1) {
        last = await request("POST", "/api/auth/login", {
          body: { username: "bloqueo.temp", password: "mala" },
        });
      }
      check(last.status === 429, `Estado ${last.status}: ${messageOf(last)}`);

      await LoginLock.update(
        { locked_until: new Date(Date.now() - 1000) },
        { where: { lock_key: lockKeyFor(lockedUser.id, "bloqueo.temp") } }
      );

      const result = await request("POST", "/api/auth/login", {
        body: { username: "bloqueo.temp", password: "clave1234" },
      });
      check(result.status === 200, `Estado ${result.status}: ${messageOf(result)}`);
      check(Boolean(result.data.accessToken), "No entregó acceso al vencer el bloqueo");
    });

    it("CP38 No se puede editar el stock desde ingredientes", async () => {
      const created = await request("POST", "/api/catalog/ingredients", {
        token: adminToken,
        body: {
          name: "Sal parrillera",
          unit: "kg",
          stock_minimum: 1,
          stock_current: 25,
        },
      });
      check(created.status === 400, `Estado ${created.status}: ${messageOf(created)}`);
      check(messageOf(created).includes("Inventario"), messageOf(created));

      const patched = await request("PATCH", `/api/catalog/ingredients/${ingredientId}`, {
        token: adminToken,
        body: { stock_current: 99 },
      });
      check(patched.status === 400, `Estado ${patched.status}: ${messageOf(patched)}`);
      check(messageOf(patched).includes("Inventario"), messageOf(patched));
    });
});
