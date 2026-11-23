
// Historias evaluadas: HU11, HU21, HU18, HU13, HU20, HU19, HU22

import type { Server } from "node:http";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.test", quiet: true });

const TEST_PORT = Number(process.env.TEST_PORT_S3 || process.env.TEST_PORT || 3101);
const BASE_URL = `http://localhost:${TEST_PORT}`;

type ApiResult<T = any> = { status: number; data: T };
type Tokens = { admin: string; mesero: string; mesero2: string; cocinero: string; cajero: string };
type Ids = { admin: number; mesero: number; mesero2: number; cocinero: number; cajero: number };

// ─────────────────────────────────────────────────────────────
// Base de datos de prueba
// ─────────────────────────────────────────────────────────────
const appDatabaseUrl = process.env.DATABASE_URL || "";
const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";

const sameDatabase = (left: string, right: string) => {
  const a = new URL(left);
  const b = new URL(right);
  return a.host === b.host && a.pathname === b.pathname;
};

const useTestDatabase = () => {
  if (!testDatabaseUrl) throw new Error("Falta TEST_DATABASE_URL en .env.test");
  if (appDatabaseUrl && sameDatabase(appDatabaseUrl, testDatabaseUrl)) {
    throw new Error("TEST_DATABASE_URL apunta a la misma base que DATABASE_URL");
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
};

// ─────────────────────────────────────────────────────────────
// Cliente HTTP
// ─────────────────────────────────────────────────────────────
async function request<T = any>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const messageOf = (r: ApiResult): string =>
  typeof r.data?.message === "string" ? r.data.message : "";

// ─────────────────────────────────────────────────────────────
// Variables globales base (para el Setup global)
// ─────────────────────────────────────────────────────────────
let server: Server;
let tokens: Tokens;
let ids: Ids;

// ─────────────────────────────────────────────────────────────
// Setup global
// ─────────────────────────────────────────────────────────────
const prepareSchemaAndSeed = async () => {
  const { sequelize } = await import("../src/config/database");
  const { User, Table } = await import("../src/models/index");
  const { hashPassword } = await import("../src/helpers/password");

  await sequelize.authenticate();
  await sequelize.query("SET lock_timeout = '8s'");
  await sequelize.query("SET statement_timeout = '60s'");
  await sequelize.query("DROP SCHEMA IF EXISTS public CASCADE");
  await sequelize.query("CREATE SCHEMA public");
  await sequelize.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
  await sequelize.query("GRANT ALL ON SCHEMA public TO public");
  await sequelize.sync();

  const users = [
    { name: "Administrador", username: "admin", email: "admin@timbo.com", password: "admin123", role: "admin" as const },
    { name: "Mesero Demo", username: "mesero", email: "mesero@timbo.com", password: "mesero123", role: "mesero" as const },
    { name: "Cocinero Demo", username: "cocinero", email: "cocinero@timbo.com", password: "cocinero123", role: "cocinero" as const },
    { name: "Mesero Dos", username: "mesero2", email: "mesero2@timbo.com", password: "mesero123", role: "mesero" as const },
    { name: "Cajero Demo", username: "cajero", email: "cajero@timbo.com", password: "cajero123", role: "cajero" as const },
  ];

  for (const item of users) {
    await User.create({
      name: item.name,
      username: item.username,
      email: item.email,
      password_hash: await hashPassword(item.password),
      role: item.role,
      is_active: true,
      email_verified: true,
    });
  }

  const mesas = Array.from({ length: 30 }, (_, i) => ({ number: i + 1, capacity: 4, is_active: true }));
  await Table.bulkCreate(mesas);
};

const loginAs = async (username: string, password: string) => {
  const res = await request("POST", "/api/auth/login", { body: { username, password } });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login falló para ${username}: ${JSON.stringify(res)}`);
  }
  return res.data.accessToken as string;
};

beforeAll(async () => {
  useTestDatabase();
  await prepareSchemaAndSeed();
  const { default: app } = await import("../src/app");
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, () => resolve());
  });
  tokens = {
    admin: await loginAs("admin", "admin123"),
    mesero: await loginAs("mesero", "mesero123"),
    cocinero: await loginAs("cocinero", "cocinero123"),
    mesero2: await loginAs("mesero2", "mesero123"),
    cajero: await loginAs("cajero", "cajero123"),
  };
  const { User } = await import("../src/models/index");
  const idOf = async (username: string) => Number((await User.findOne({ where: { username } }))!.id);
  ids = {
    admin: await idOf("admin"),
    mesero: await idOf("mesero"),
    mesero2: await idOf("mesero2"),
    cocinero: await idOf("cocinero"),
    cajero: await idOf("cajero"),
  };
}, 120000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const { sequelize } = await import("../src/config/database");
  await sequelize.close();
});

// ─────────────────────────────────────────────────────────────
// Funciones de apoyo del sprint 3
// ─────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const listaDe = (r: ApiResult) => (Array.isArray(r.data) ? r.data : r.data?.tickets ?? r.data?.items ?? []);

async function crearCategoria(nombre: string) {
  const r = await request("POST", "/api/catalog/categories", { token: tokens.admin, body: { name: nombre } });
  if (r.status !== 201) throw new Error(`Categoría: ${JSON.stringify(r)}`);
  return r.data.id as number;
}

async function crearIngrediente(nombre: string, stock: number) {
  const r = await request("POST", "/api/catalog/ingredients", { token: tokens.admin, body: { name: nombre, unit: "kg" } });
  if (r.status !== 201) throw new Error(`Ingrediente: ${JSON.stringify(r)}`);
  await request("POST", "/api/inventory/entries", {
    token: tokens.admin, body: { ingredient_id: r.data.id, quantity: stock, reason: "Stock inicial de prueba" },
  });
  return r.data.id as number;
}

async function crearPlato(nombre: string, precio: number, categoriaId: number, receta: { ingrediente: number; cantidad: number }[] = []) {
  const r = await request("POST", "/api/catalog/dishes", { token: tokens.admin, body: { name: nombre, price: precio, category_id: categoriaId } });
  if (r.status !== 201) throw new Error(`Plato: ${JSON.stringify(r)}`);
  if (receta.length) {
    await request("PUT", `/api/catalog/dishes/${r.data.id}/recipe`, {
      token: tokens.admin, body: { items: receta.map((i) => ({ ingredient_id: i.ingrediente, quantity: i.cantidad })) },
    });
  }
  return r.data.id as number;
}

async function stockDe(ingredienteId: number) {
  const r = await request("GET", "/api/catalog/ingredients", { token: tokens.admin });
  const fila = listaDe(r).find((i: any) => i.id === ingredienteId);
  return Number(fila.stock_current);
}

async function abrirPedido(token: string, body: unknown) {
  const r = await request("POST", "/api/orders", { token, body });
  if (r.status !== 201) throw new Error(`Abrir pedido: ${JSON.stringify(r)}`);
  return r.data.id as number;
}

async function agregarPlato(token: string, pedidoId: number, platoId: number, cantidad = 1) {
  const r = await request("POST", `/api/orders/${pedidoId}/details`, { token, body: { dish_id: platoId, quantity: cantidad } });
  if (r.status !== 201) throw new Error(`Agregar plato: ${JSON.stringify(r)}`);
}

async function confirmarPedido(token: string, pedidoId: number) {
  const r = await request("POST", `/api/orders/${pedidoId}/confirm`, { token });
  if (r.status !== 200) throw new Error(`Confirmar: ${JSON.stringify(r)}`);
  const pedido = await request("GET", `/api/orders/${pedidoId}`, { token: tokens.admin });
  return { pedido: pedido.data, comandaId: pedido.data.kitchen_ticket.id as number };
}

// Pedido de mesa ya confirmado (con comanda pendiente)
async function pedidoDeMesaConfirmado(mesa: number, platoId: number, cantidad = 1, token = tokens.mesero) {
  const id = await abrirPedido(token, { table_id: mesa });
  await agregarPlato(token, id, platoId, cantidad);
  const { comandaId } = await confirmarPedido(token, id);
  return { id, comandaId };
}

const estadoCocina = (comandaId: number, status: string, token = tokens.cocinero) =>
  request("PATCH", `/api/kitchen/${comandaId}/status`, { token, body: { status } });

const comandaEnCocina = async (pedidoId: number, token = tokens.cocinero) => {
  const r = await request("GET", "/api/kitchen", { token });
  return listaDe(r).find((c: any) => c.order_id === pedidoId);
};

const datosDelivery = (extra: Record<string, unknown> = {}) => ({
  modality: "delivery",
  delivery_customer_name: "Carlos Ruiz",
  delivery_phone: "987654321",
  delivery_address: "Av. Perú 123",
  ...extra,
});

// ═══════════════════════════════════════════════════════════════
// HU11 — Visualizar y cambiar el estado de la comanda
// ═══════════════════════════════════════════════════════════════
describe("HU11 - Visualizar y cambiar el estado de la comanda", () => {
  let platoId = 0;
  let pedidoA = 0, pedidoB = 0, pedidoC = 0;
  let comandaA = 0, comandaB = 0, comandaC = 0;

  beforeAll(async () => {
    const cat = await crearCategoria("Cat HU11");
    const ing = await crearIngrediente("Insumo HU11", 100);
    platoId = await crearPlato("Plato HU11", 25, cat, [{ ingrediente: ing, cantidad: 0.2 }]);
    ({ id: pedidoA, comandaId: comandaA } = await pedidoDeMesaConfirmado(1, platoId));
    await sleep(25);
    ({ id: pedidoB, comandaId: comandaB } = await pedidoDeMesaConfirmado(2, platoId));
    await sleep(25);
    ({ id: pedidoC, comandaId: comandaC } = await pedidoDeMesaConfirmado(3, platoId, 2));
  });

  it("CP115 - Las comandas se muestran de la más antigua a la más reciente", async () => {
    const res = await request("GET", "/api/kitchen", { token: tokens.cocinero });
    expect(res.status).toBe(200);
    const comandas = listaDe(res);
    const fechas = comandas.map((c: any) => new Date(c.created_at).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
    const orden = comandas.map((c: any) => c.order_id).filter((id: number) => [pedidoA, pedidoB, pedidoC].includes(id));
    expect(orden).toEqual([pedidoA, pedidoB, pedidoC]);
  });

  it("CP116 - La comanda nueva nace en estado Pendiente", async () => {
    const c = await comandaEnCocina(pedidoA);
    expect(c.status).toBe("pendiente");
  });

  it("CP117 - La comanda muestra pedido, mesa, hora, platos, cantidades y estado", async () => {
    const c = await comandaEnCocina(pedidoC);
    expect(c.order.code).toBeTruthy();
    expect(c.order.table.number).toBe(3);
    expect(c.created_at).toBeTruthy();
    expect(c.order.details[0].quantity).toBe(2);
    expect(c.order.details[0].dish.name).toBe("Plato HU11");
    expect(c.status).toBe("pendiente");
  });

  it("CP118 - Cocinero pasa la comanda de Pendiente a En preparación", async () => {
    const res = await estadoCocina(comandaA, "en_preparacion");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("en_preparacion");
    expect(res.data.status_changed_by).toBe(ids.cocinero);
  });

  it("CP119 - Cocinero pasa la comanda de En preparación a Listo", async () => {
    const res = await estadoCocina(comandaA, "listo");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("listo");
  });

  it("CP120 - Cocinero pasa la comanda de Listo a Entregado", async () => {
    const res = await estadoCocina(comandaA, "entregado");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("entregado");
  });

  it("CP121 - Un estado que no existe se rechaza", async () => {
    const res = await estadoCocina(comandaB, "cocinando");
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("estado");
  });

  it("CP122 - No se puede saltar el flujo (de Pendiente a Entregado)", async () => {
    const res = await estadoCocina(comandaB, "entregado");
    expect(res.status).toBe(400);
  });

  it("CP123 - No se puede retroceder una comanda Entregada a Pendiente", async () => {
    const res = await estadoCocina(comandaA, "pendiente");
    expect(res.status).toBe(400);
  });

  it("CP124 - Cada cambio registra estado anterior, nuevo, fecha, hora y usuario", async () => {
    const c = await comandaEnCocina(pedidoA);
    const historial = c.history ?? c.status_history ?? c.status_changes ?? [];
    expect(historial.length).toBeGreaterThanOrEqual(3);
    expect(historial[0].previous_status).toBeTruthy();
    expect(historial[0].new_status ?? historial[0].status).toBeTruthy();
    expect(historial[0].changed_by ?? historial[0].user_id).toBeTruthy();
    expect(historial[0].created_at ?? historial[0].changed_at).toBeTruthy();
  });

  it("CP125 - La comanda guarda el usuario y la hora del último cambio", async () => {
    const c = await comandaEnCocina(pedidoA);
    expect(c.status_changed_by).toBe(ids.cocinero);
    expect(c.status_changed_by_user.name).toBe("Cocinero Demo");
    expect(new Date(c.status_changed_at).getTime()).not.toBeNaN();
  });

  it("CP126 - El mesero consulta el estado de las comandas de sus pedidos", async () => {
    const res = await request("GET", "/api/kitchen", { token: tokens.mesero });
    expect(res.status).toBe(200);
    const vistaMesero = listaDe(res).find((x: any) => x.order_id === pedidoA);
    const vistaCocina = await comandaEnCocina(pedidoA);
    expect(vistaMesero.status).toBe(vistaCocina.status);
    expect(vistaMesero.order.code).toBe(vistaCocina.order.code);
  });

  it("CP127 - El mesero no puede cambiar el estado de una comanda", async () => {
    const antes = (await comandaEnCocina(pedidoC)).status;
    const res = await estadoCocina(comandaC, "en_preparacion", tokens.mesero);
    expect(res.status).toBe(403);
    expect((await comandaEnCocina(pedidoC)).status).toBe(antes);
  });

  it("CP128 - El cajero no puede ver ni cambiar comandas", async () => {
    const cambio = await estadoCocina(comandaC, "en_preparacion", tokens.cajero);
    expect(cambio.status).toBe(403);
    const ver = await request("GET", "/api/kitchen", { token: tokens.cajero });
    expect(ver.status).toBe(403);
  });

  it("CP129 - Comanda que no existe", async () => {
    const res = await estadoCocina(999999, "listo");
    expect(res.status).toBe(404);
    expect(messageOf(res)).toContain("Comanda no encontrada");
  });

  it("CP130 - Sin sesión no se accede a la cocina", async () => {
    const res = await request("GET", "/api/kitchen");
    expect(res.status).toBe(401);
  });

  it("CP131 - La comanda se actualiza según el avance de sus platos", async () => {
    const cat = await crearCategoria("Cat HU11 platos");
    const p2 = await crearPlato("Plato HU11 B", 18, cat);
    const id = await abrirPedido(tokens.admin, datosDelivery());
    await agregarPlato(tokens.admin, id, platoId, 1);
    await agregarPlato(tokens.admin, id, p2, 1);
    await confirmarPedido(tokens.admin, id);
    const c = await comandaEnCocina(id);
    const [d1, d2] = c.order.details;
    const uno = await request("PATCH", `/api/kitchen/details/${d1.id}/status`, { token: tokens.cocinero, body: { status: "listo" } });
    expect(uno.status).toBe(200);
    expect(uno.data.status).toBe("en_preparacion");
    const dos = await request("PATCH", `/api/kitchen/details/${d2.id}/status`, { token: tokens.cocinero, body: { status: "listo" } });
    expect(dos.data.status).toBe("listo");
  });
});

// ═══════════════════════════════════════════════════════════════
// HU21 — Registrar pedidos según modalidad de atención
// ═══════════════════════════════════════════════════════════════
describe("HU21 - Registrar pedidos según modalidad de atención", () => {
  let platoId = 0;
  let pedidoMesa = 0;
  let pedidoDelivery = 0;

  beforeAll(async () => {
    const cat = await crearCategoria("Cat HU21");
    const ing = await crearIngrediente("Insumo HU21", 100);
    platoId = await crearPlato("Plato HU21", 22, cat, [{ ingrediente: ing, cantidad: 0.1 }]);
  });

  it("CP132 - Administrador abre un pedido de modalidad Mesa con mesa disponible", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: { modality: "mesa", table_id: 4 } });
    expect(res.status).toBe(201);
    expect(res.data.modality).toBe("mesa");
    expect(res.data.table_id).toBe(4);
    expect(res.data.code.startsWith("MES-04-")).toBe(true);
    pedidoMesa = res.data.id;
  });

  it("CP133 - Modalidad Mesa sin elegir mesa", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: { modality: "mesa" } });
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("mesa");
  });

  it("CP134 - Modalidad Mesa en una mesa ocupada", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: { modality: "mesa", table_id: 4 } });
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("ocupada");
  });

  it("CP135 - Modalidad Mesa en una mesa que no existe", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: { modality: "mesa", table_id: 9999 } });
    expect(res.status).toBe(404);
  });

  it("CP136 - Cajero abre un pedido Delivery sin mesa", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.cajero, body: datosDelivery() });
    expect(res.status).toBe(201);
    expect(res.data.modality).toBe("delivery");
    expect(res.data.table_id).toBeNull();
    expect(res.data.code.startsWith("DEL-")).toBe(true);
    pedidoDelivery = res.data.id;
  });

  it("CP137 - Delivery exige nombre, teléfono y dirección", async () => {
    const sinNombre = await request("POST", "/api/orders", { token: tokens.admin, body: datosDelivery({ delivery_customer_name: "" }) });
    expect(sinNombre.status).toBe(400);
    const sinTel = await request("POST", "/api/orders", { token: tokens.admin, body: datosDelivery({ delivery_phone: "" }) });
    expect(sinTel.status).toBe(400);
    expect(messageOf(sinTel).toLowerCase()).toContain("teléfono");
    const sinDir = await request("POST", "/api/orders", { token: tokens.admin, body: datosDelivery({ delivery_address: "" }) });
    expect(sinDir.status).toBe(400);
    expect(messageOf(sinDir).toLowerCase()).toContain("dirección");
  });

  it("CP138 - Un Delivery no ocupa ninguna mesa aunque se envíe una", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: datosDelivery({ table_id: 5 }) });
    expect(res.status).toBe(201);
    expect(res.data.table_id).toBeNull();
    const mesas = await request("GET", "/api/orders/tables", { token: tokens.admin });
    expect(mesas.data.find((m: any) => m.id === 5).occupied).toBe(false);
  });

  it("CP139 - El cajero puede registrar también un pedido de modalidad Mesa", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.cajero, body: { modality: "mesa", table_id: 6 } });
    expect(res.status).toBe(201);
  });

  it("CP140 - El mesero no puede registrar un pedido Delivery", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.mesero, body: datosDelivery() });
    expect(res.status).toBe(403);
  });

  it("CP141 - La modalidad se guarda como dato del pedido", async () => {
    const mesa = await request("GET", `/api/orders/${pedidoMesa}`, { token: tokens.admin });
    expect(mesa.data.modality).toBe("mesa");
    const del = await request("GET", `/api/orders/${pedidoDelivery}`, { token: tokens.admin });
    expect(del.data.modality).toBe("delivery");
    expect(del.data.delivery_customer_name).toBe("Carlos Ruiz");
  });

  it("CP142 - La modalidad se conserva al confirmar el pedido", async () => {
    await agregarPlato(tokens.cajero, pedidoDelivery, platoId, 2);
    const { pedido } = await confirmarPedido(tokens.cajero, pedidoDelivery);
    expect(pedido.status).toBe("confirmado");
    expect(pedido.modality).toBe("delivery");
    expect(pedido.table_id).toBeNull();
  });

  it("CP143 - La comanda de cocina muestra la modalidad Delivery", async () => {
    const c = await comandaEnCocina(pedidoDelivery);
    expect(c.order.modality).toBe("delivery");
    expect(c.order.delivery_customer_name).toBe("Carlos Ruiz");
    expect(c.order.table).toBeNull();
  });

  it("CP144 - La comanda de cocina muestra la modalidad Mesa y su mesa", async () => {
    await agregarPlato(tokens.admin, pedidoMesa, platoId, 1);
    await confirmarPedido(tokens.admin, pedidoMesa);
    const c = await comandaEnCocina(pedidoMesa);
    expect(c.order.modality).toBe("mesa");
    expect(c.order.table.number).toBe(4);
  });

  it("CP145 - Pedido para llevar sin mesa (modalidad adicional)", async () => {
    const res = await request("POST", "/api/orders", {
      token: tokens.admin, body: { modality: "para_llevar", delivery_customer_name: "Ana Torres" },
    });
    expect(res.status).toBe(201);
    expect(res.data.modality).toBe("para_llevar");
    expect(res.data.code.startsWith("LLE-")).toBe(true);
  });

  it("CP146 - Una modalidad desconocida se trata como Mesa y exige mesa", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.admin, body: { modality: "express" } });
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("mesa");
  });

  it("CP147 - Sin sesión no se registra un pedido", async () => {
    const res = await request("POST", "/api/orders", { body: { table_id: 6 } });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// HU18 — Gestionar y unir mesas
// ═══════════════════════════════════════════════════════════════
describe("HU18 - Gestionar y unir mesas", () => {
  const mesas = async (token = tokens.admin) => (await request("GET", "/api/orders/tables", { token })).data as any[];
  const mesa = async (n: number, token = tokens.admin) => (await mesas(token)).find((m) => m.number === n);
  let grupo89 = 0;
  let grupo101112 = 0;
  let pedidoGrupo = 0;

  it("CP148 - Administrador inhabilita una mesa indicando el motivo", async () => {
    const res = await request("PATCH", "/api/orders/tables/7", {
      token: tokens.admin, body: { is_active: false, reason: "Mesa en mantenimiento" },
    });
    expect(res.status).toBe(200);
    expect(res.data.is_active).toBe(false);
  });

  it("CP149 - Inhabilitar sin motivo o sin indicar el valor", async () => {
    const sinMotivo = await request("PATCH", "/api/orders/tables/8", { token: tokens.admin, body: { is_active: false } });
    expect(sinMotivo.status).toBe(400);
    expect(messageOf(sinMotivo).toLowerCase()).toContain("motivo");
    const sinValor = await request("PATCH", "/api/orders/tables/8", { token: tokens.admin, body: { reason: "x" } });
    expect(sinValor.status).toBe(400);
  });

  it("CP150 - La mesa inhabilitada no aparece disponible para el mesero", async () => {
    const paraMesero = await mesas(tokens.mesero);
    expect(paraMesero.find((m) => m.number === 7)).toBeUndefined();
    expect((await mesa(7)).is_active).toBe(false);
  });

  it("CP151 - No se abre un pedido en una mesa inhabilitada", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.mesero, body: { table_id: 7 } });
    expect(res.status).toBe(404);
    expect(messageOf(res)).toContain("Mesa no válida");
  });

  it("CP152 - Administrador vuelve a habilitar la mesa", async () => {
    const res = await request("PATCH", "/api/orders/tables/7", {
      token: tokens.admin, body: { is_active: true, reason: "Mantenimiento terminado" },
    });
    expect(res.status).toBe(200);
    expect(res.data.is_active).toBe(true);
    expect((await mesas(tokens.mesero)).find((m) => m.number === 7)).toBeTruthy();
  });

  it("CP153 - El mesero no puede inhabilitar mesas", async () => {
    const res = await request("PATCH", "/api/orders/tables/9", { token: tokens.mesero, body: { is_active: false, reason: "x" } });
    expect(res.status).toBe(403);
  });

  it("CP154 - Inhabilitar una mesa que no existe", async () => {
    const res = await request("PATCH", "/api/orders/tables/9999", { token: tokens.admin, body: { is_active: false, reason: "x" } });
    expect(res.status).toBe(404);
  });

  it("CP155 - No se inhabilita una mesa con pedido activo", async () => {
    await abrirPedido(tokens.mesero, { table_id: 7 });
    const res = await request("PATCH", "/api/orders/tables/7", { token: tokens.admin, body: { is_active: false, reason: "Prueba" } });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("pedido abierto");
    expect((await mesa(7)).is_active).toBe(true);
  });

  it("CP156 - Administrador agrupa dos mesas", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [8, 9] } });
    expect(res.status).toBe(200);
    const m8 = res.data.find((m: any) => m.number === 8);
    const m9 = res.data.find((m: any) => m.number === 9);
    expect(m8.group_id).not.toBeNull();
    expect(m8.group_id).toBe(m9.group_id);
    expect(m8.group_numbers).toEqual([8, 9]);
    grupo89 = m8.group_id;
  });

  it("CP157 - Administrador agrupa tres mesas", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [10, 11, 12] } });
    expect(res.status).toBe(200);
    const m = res.data.find((x: any) => x.number === 10);
    expect(m.group_numbers).toEqual([10, 11, 12]);
    grupo101112 = m.group_id;
  });

  it("CP158 - Agrupar con una sola mesa", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [13] } });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("al menos dos");
  });

  it("CP159 - No se agrupa una mesa inhabilitada", async () => {
    await request("PATCH", "/api/orders/tables/13", { token: tokens.admin, body: { is_active: false, reason: "Mesa dañada" } });
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [13, 14] } });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("inhabilitada");
  });

  it("CP160 - No se agrupa una mesa con pedido activo", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [7, 14] } });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("pedido abierto");
  });

  it("CP161 - No se repite una agrupación que ya existe", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [8, 9] } });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("ya están agrupadas");
  });

  it("CP162 - El cajero no puede agrupar mesas", async () => {
    const res = await request("POST", "/api/orders/tables/groups", { token: tokens.cajero, body: { table_ids: [14, 15] } });
    expect(res.status).toBe(403);
  });

  it("CP163 - El pedido de una mesa agrupada conserva la identificación de las mesas", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.mesero, body: { table_id: 8 } });
    expect(res.status).toBe(201);
    const numeros = res.data.tables.map((t: any) => t.number).sort((a: number, b: number) => a - b);
    expect(numeros).toEqual([8, 9]);
    expect(res.data.code).toContain("08+09");
    pedidoGrupo = res.data.id;
  });

  it("CP164 - Con el pedido abierto, las dos mesas del grupo quedan ocupadas", async () => {
    expect((await mesa(8)).occupied).toBe(true);
    expect((await mesa(9)).occupied).toBe(true);
  });

  it("CP165 - No se separa un grupo con pedido activo", async () => {
    const res = await request("DELETE", `/api/orders/tables/groups/${grupo89}`, { token: tokens.admin });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("pedido abierto");
    expect((await mesa(8)).group_id).toBe(grupo89);
  });

  it("CP166 - No se inhabilita una mesa que pertenece a un grupo con pedido activo", async () => {
    const res = await request("PATCH", "/api/orders/tables/9", { token: tokens.admin, body: { is_active: false, reason: "Prueba" } });
    expect(res.status).toBe(400);
  });

  it("CP167 - Administrador separa un grupo sin pedidos", async () => {
    const res = await request("DELETE", `/api/orders/tables/groups/${grupo101112}`, { token: tokens.admin });
    expect(res.status).toBe(200);
    for (const n of [10, 11, 12]) expect((await mesa(n)).group_id).toBeNull();
  });

  it("CP168 - El mesero no separa un grupo armado por administración", async () => {
    const g = await request("POST", "/api/orders/tables/groups", { token: tokens.admin, body: { table_ids: [16, 17] } });
    const id = g.data.find((m: any) => m.number === 16).group_id;
    const res = await request("DELETE", `/api/orders/tables/groups/${id}`, { token: tokens.mesero });
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("administración");
  });

  it("CP169 - Unir dos mesas libres abre un pedido que las incluye", async () => {
    const res = await request("POST", "/api/orders/join-tables", {
      token: tokens.mesero, body: { from_table_id: 18, to_table_id: 19 },
    });
    expect(res.status).toBe(200);
    expect(res.data.tables.map((t: any) => t.number).sort((a: number, b: number) => a - b)).toEqual([18, 19]);
  });

  it("CP170 - No se unen mesas si una tiene pedido abierto", async () => {
    const res = await request("POST", "/api/orders/join-tables", {
      token: tokens.mesero, body: { from_table_id: 7, to_table_id: 15 },
    });
    expect(res.status).toBe(400);
    expect(messageOf(res).toLowerCase()).toContain("pedido abierto");
  });

  it("CP171 - Los cambios de disponibilidad y agrupación quedan registrados", async () => {
    const res = await request("GET", "/api/orders/tables/changes", { token: tokens.admin });
    expect(res.status).toBe(200);
    const disp = res.data.find((c: any) => c.kind === "disponibilidad" && c.table_number === 7 && c.detail === "Inhabilitada");
    expect(disp.reason).toBe("Mesa en mantenimiento");
    expect(disp.user_name).toBe("Administrador");
    expect(new Date(disp.at).getTime()).not.toBeNaN();
    const agr = res.data.find((c: any) => c.kind === "agrupacion" && c.detail.includes("8,9"));
    expect(agr.user_name).toBe("Administrador");
  });

  it("CP172 - El mesero no consulta el historial de mesas", async () => {
    const res = await request("GET", "/api/orders/tables/changes", { token: tokens.mesero });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════
// HU13 — Cancelar pedidos y gestionar stock o merma
// ═══════════════════════════════════════════════════════════════
describe("HU13 - Cancelar pedidos y gestionar stock o merma", () => {
  let ingId = 0;
  let platoId = 0;
  const cancelar = (pedidoId: number, reason: unknown, token = tokens.admin) =>
    request("POST", `/api/orders/${pedidoId}/cancel`, { token, body: { reason } });
  const movimientosDe = async (pedidoId: number) =>
    (await request("GET", `/api/orders/${pedidoId}`, { token: tokens.admin })).data.inventory_movements as any[];

  let pedidoMotivo = 0;
  let pedidoEnPrep = 0;

  beforeAll(async () => {
    const cat = await crearCategoria("Cat HU13");
    ingId = await crearIngrediente("Carne HU13", 50);
    platoId = await crearPlato("Plato HU13", 30, cat, [{ ingrediente: ingId, cantidad: 0.5 }]);
    ({ id: pedidoMotivo } = await pedidoDeMesaConfirmado(20, platoId, 2));
  });

  it("CP173 - La cancelación exige un motivo", async () => {
    const vacio = await cancelar(pedidoMotivo, "");
    expect(vacio.status).toBe(400);
    expect(messageOf(vacio)).toContain("motivo");
    const sinCampo = await request("POST", `/api/orders/${pedidoMotivo}/cancel`, { token: tokens.admin, body: {} });
    expect(sinCampo.status).toBe(400);
  });

  it("CP174 - El motivo debe tener al menos 3 caracteres", async () => {
    const res = await cancelar(pedidoMotivo, "ab");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("3 caracteres");
  });

  it("CP175 - El cocinero no puede cancelar pedidos", async () => {
    const res = await cancelar(pedidoMotivo, "Prueba de permisos", tokens.cocinero);
    expect(res.status).toBe(403);
    const pedido = await request("GET", `/api/orders/${pedidoMotivo}`, { token: tokens.admin });
    expect(pedido.data.status).toBe("confirmado");
  });

  it("CP176 - Cancelar un pedido que no existe", async () => {
    const res = await cancelar(999999, "Prueba");
    expect(res.status).toBe(404);
  });

  it("CP177 - Comanda Pendiente: se reponen los ingredientes con un movimiento de devolución", async () => {
    const antes = await stockDe(ingId);
    const { id } = await pedidoDeMesaConfirmado(21, platoId, 2); // consume 1 kg
    expect(await stockDe(ingId)).toBeCloseTo(antes - 1, 3);
    const res = await cancelar(id, "El cliente se retiró", tokens.mesero);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("cancelado");
    expect(await stockDe(ingId)).toBeCloseTo(antes, 3);
    const tipos = (await movimientosDe(id)).map((m) => m.type);
    expect(tipos).toContain("devolucion");
    expect(tipos).not.toContain("merma");
  });

  it("CP178 - Comanda En preparación: los ingredientes quedan como merma y no se reponen", async () => {
    const antes = await stockDe(ingId);
    const { id, comandaId } = await pedidoDeMesaConfirmado(22, platoId, 2);
    pedidoEnPrep = id;
    await estadoCocina(comandaId, "en_preparacion");
    const res = await cancelar(id, "Error al tomar el pedido", tokens.cajero);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("cancelado");
    expect(await stockDe(ingId)).toBeCloseTo(antes - 1, 3);
    const mermas = (await movimientosDe(id)).filter((m) => m.type === "merma");
    expect(mermas.length).toBe(1);
    expect(Number(mermas[0].quantity)).toBeCloseTo(1, 3);
    expect(res.data.cancellation.stock_action).toBe("merma");
  });

  it("CP179 - Comanda Listo: los ingredientes quedan como merma y no se reponen", async () => {
    const antes = await stockDe(ingId);
    const { id, comandaId } = await pedidoDeMesaConfirmado(23, platoId, 1); // 0.5 kg
    await estadoCocina(comandaId, "en_preparacion");
    await estadoCocina(comandaId, "listo");
    const res = await cancelar(id, "Cliente no aceptó la espera");
    expect(res.status).toBe(200);
    expect(await stockDe(ingId)).toBeCloseTo(antes - 0.5, 3);
    expect((await movimientosDe(id)).some((m) => m.type === "merma")).toBe(true);
    expect((await movimientosDe(id)).some((m) => m.type === "devolucion")).toBe(false);
  });

  it("CP180 - No se cancela un pedido cuya comanda ya fue Entregada", async () => {
    const { id, comandaId } = await pedidoDeMesaConfirmado(24, platoId, 1);
    await estadoCocina(comandaId, "en_preparacion");
    await estadoCocina(comandaId, "listo");
    await estadoCocina(comandaId, "entregado");
    const res = await cancelar(id, "Intento de cancelar entregado");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("ya salió a mesa");
    const pedido = await request("GET", `/api/orders/${id}`, { token: tokens.admin });
    expect(pedido.data.status).toBe("confirmado");
  });

  it("CP181 - No se cancela dos veces el mismo pedido", async () => {
    const res = await cancelar(pedidoEnPrep, "Segundo intento");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("ya está cancelado");
  });

  it("CP182 - Un pedido en edición se cancela sin mover el inventario", async () => {
    const antes = await stockDe(ingId);
    const id = await abrirPedido(tokens.mesero, { table_id: 25 });
    await agregarPlato(tokens.mesero, id, platoId, 2);
    const res = await cancelar(id, "El cliente cambió de mesa");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("cancelado");
    expect(await movimientosDe(id)).toHaveLength(0);
    expect(await stockDe(ingId)).toBeCloseTo(antes, 3);
  });

  it("CP183 - El pedido y su comanda se conservan en el historial tras cancelar", async () => {
    const pedido = await request("GET", `/api/orders/${pedidoEnPrep}`, { token: tokens.admin });
    expect(pedido.data.status).toBe("cancelado");
    expect(pedido.data.details.length).toBe(1);
    expect(pedido.data.kitchen_ticket.id).toBeTruthy();
    const hist = await request("GET", `/api/orders/history?date=${lima()}&status=cancelado`, { token: tokens.admin });
    const fila = hist.data.orders.find((o: any) => o.id === pedidoEnPrep);
    expect(fila).toBeTruthy();
    expect(fila.kitchen_ticket).toBeTruthy();
  });

  it("CP184 - El historial guarda estado anterior, usuario, motivo, fecha y hora", async () => {
    const p = (await request("GET", `/api/orders/${pedidoEnPrep}`, { token: tokens.admin })).data;
    expect(p.cancellation.previous_status).toBe("confirmado");
    expect(p.cancellation.previous_kitchen_status).toBe("en_preparacion");
    expect(p.cancellation.reason).toBe("Error al tomar el pedido");
    expect(p.cancellation.cancelled_by_user.name).toBe("Cajero Demo");
    expect(new Date(p.cancellation.created_at).getTime()).not.toBeNaN();
    expect(p.cancelled_at).toBeTruthy();
    expect(p.cancel_reason).toBe("Error al tomar el pedido");
  });

  it("CP185 - Los movimientos de inventario quedan vinculados al pedido cancelado", async () => {
    const mov = await request("GET", "/api/inventory/movements", { token: tokens.admin });
    const delPedido = listaDe(mov).filter((m: any) => m.order_id === pedidoEnPrep && m.type === "merma");
    expect(delPedido.length).toBe(1);
    expect(delPedido[0].reason).toContain("cancelación");
    expect(delPedido[0].user.name).toBe("Cajero Demo");
  });

  it("CP186 - La comanda de un pedido cancelado sale de la pantalla de cocina", async () => {
    expect(await comandaEnCocina(pedidoEnPrep)).toBeUndefined();
  });

  it("CP187 - Al cancelar, la mesa queda libre para otro pedido", async () => {
    const res = await request("POST", "/api/orders", { token: tokens.mesero, body: { table_id: 22 } });
    expect(res.status).toBe(201);
  });

  it("CP188 - Si falla el registro de merma no queda ninguna cancelación parcial", async () => {
    const { id } = await pedidoDeMesaConfirmado(26, platoId, 1);
    const { sequelize } = await import("../src/config/database");
    const { InventoryMovement, OrderCancellation } = await import("../src/models/index");
    const original = InventoryMovement.create;
    const stockAntes = await stockDe(ingId);
    // Se hace pasar la comanda a En preparación para que la cancelación intente registrar merma
    const comanda = await comandaEnCocina(id);
    await estadoCocina(comanda.id, "en_preparacion");
    (InventoryMovement as any).create = async () => { throw new Error("fallo simulado"); };
    let res: ApiResult;
    try {
      res = await cancelar(id, "Prueba de fallo");
    } finally {
      (InventoryMovement as any).create = original;
    }
    expect(res.status).toBe(500);
    const pedido = await request("GET", `/api/orders/${id}`, { token: tokens.admin });
    expect(pedido.data.status).toBe("confirmado");
    expect(pedido.data.cancel_reason).toBeNull();
    expect(await OrderCancellation.count({ where: { order_id: id } })).toBe(0);
    expect(await stockDe(ingId)).toBeCloseTo(stockAntes, 3);
    await sequelize.query("SELECT 1");
  });

  it("CP189 - Sin sesión no se cancela un pedido", async () => {
    const res = await request("POST", `/api/orders/${pedidoMotivo}/cancel`, { body: { reason: "Sin sesión" } });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// HU20 — Notificar al mesero cuando una comanda esté lista
// ═══════════════════════════════════════════════════════════════
describe("HU20 - Notificar al mesero cuando una comanda esté lista", () => {
  let platoA = 0, platoB = 0;
  let pedido1 = 0, comanda1 = 0, codigo1 = "";
  let pedido2 = 0, comanda2 = 0;
  let notificacionId = 0;
  const notis = async (token: string) => (await request("GET", "/api/notifications", { token })).data;

  beforeAll(async () => {
    const cat = await crearCategoria("Cat HU20");
    platoA = await crearPlato("Parrilla HU20", 45, cat);
    platoB = await crearPlato("Chicha HU20", 8, cat);
    pedido1 = await abrirPedido(tokens.mesero, { table_id: 27 });
    await agregarPlato(tokens.mesero, pedido1, platoA, 1);
    await agregarPlato(tokens.mesero, pedido1, platoB, 2);
    const c1 = await confirmarPedido(tokens.mesero, pedido1);
    comanda1 = c1.comandaId;
    codigo1 = c1.pedido.code;
    pedido2 = await abrirPedido(tokens.mesero2, { table_id: 28 });
    await agregarPlato(tokens.mesero2, pedido2, platoA, 1);
    comanda2 = (await confirmarPedido(tokens.mesero2, pedido2)).comandaId;
  });

  it("CP190 - Antes de que la comanda esté Lista no hay notificaciones", async () => {
    await estadoCocina(comanda1, "en_preparacion");
    const lista = await notis(tokens.mesero);
    expect(lista.pending.filter((n: any) => n.order_id === pedido1)).toHaveLength(0);
  });

  it("CP191 - Al marcar la comanda Lista se genera una notificación para el mesero", async () => {
    const res = await estadoCocina(comanda1, "listo");
    expect(res.status).toBe(200);
    const lista = await notis(tokens.mesero);
    const propias = lista.pending.filter((n: any) => n.order_id === pedido1);
    expect(propias.length).toBeGreaterThanOrEqual(1);
    notificacionId = propias[0].id;
  });

  it("CP192 - La notificación muestra pedido, mesa, fecha y hora", async () => {
    const lista = await notis(tokens.mesero);
    const n = lista.pending.find((x: any) => x.id === notificacionId);
    expect(n.order_code).toBe(codigo1);
    expect(n.table_label).toBe("Mesa 27");
    const generada = new Date(n.generated_at).getTime();
    expect(generada).not.toBeNaN();
    expect(Math.abs(Date.now() - generada)).toBeLessThan(5 * 60 * 1000);
  });

  it("CP193 - La notificación llega solo al mesero responsable del pedido", async () => {
    const otro = await notis(tokens.mesero2);
    expect(otro.pending.filter((n: any) => n.order_id === pedido1)).toHaveLength(0);
  });

  it("CP194 - El mesero consulta sus notificaciones pendientes y el contador", async () => {
    const lista = await notis(tokens.mesero);
    expect(lista.pending_count).toBe(lista.pending.length);
    expect(lista.pending_count).toBeGreaterThan(0);
  });

  it("CP195 - Una comanda con dos platos genera una notificación por plato, sin repetidas", async () => {
    const lista = await notis(tokens.mesero);
    const propias = lista.pending.filter((n: any) => n.order_id === pedido1);
    expect(propias).toHaveLength(2);
    const detalles = propias.map((n: any) => n.order_detail_id);
    expect(new Set(detalles).size).toBe(2);
  });

  it("CP196 - Repetir el estado Listo no genera notificaciones duplicadas", async () => {
    const antes = (await notis(tokens.mesero)).pending.filter((n: any) => n.order_id === pedido1).length;
    await estadoCocina(comanda1, "listo");
    await estadoCocina(comanda1, "listo");
    const despues = (await notis(tokens.mesero)).pending.filter((n: any) => n.order_id === pedido1).length;
    expect(despues).toBe(antes);
  });

  it("CP197 - Marcar un plato Listo notifica ese plato al mesero", async () => {
    const c = await comandaEnCocina(pedido2);
    const detalle = c.order.details[0];
    const res = await request("PATCH", `/api/kitchen/details/${detalle.id}/status`, { token: tokens.cocinero, body: { status: "listo" } });
    expect(res.status).toBe(200);
    const lista = await notis(tokens.mesero2);
    const n = lista.pending.find((x: any) => x.order_id === pedido2);
    expect(n.dish_label).toContain("Parrilla HU20");
    expect(n.table_label).toBe("Mesa 28");
    expect(comanda2).toBeGreaterThan(0);
  });

  it("CP198 - El mesero marca una notificación como atendida", async () => {
    const res = await request("PATCH", `/api/notifications/${notificacionId}/attend`, { token: tokens.mesero });
    expect(res.status).toBe(200);
    expect(res.data.attended_at).toBeTruthy();
  });

  it("CP199 - Las notificaciones atendidas pasan al historial", async () => {
    const lista = await notis(tokens.mesero);
    expect(lista.pending.find((n: any) => n.id === notificacionId)).toBeUndefined();
    expect(lista.history.find((n: any) => n.id === notificacionId)).toBeTruthy();
  });

  it("CP200 - Atender dos veces no cambia la fecha de atención", async () => {
    const lista = await notis(tokens.mesero);
    const primera = lista.history.find((n: any) => n.id === notificacionId).attended_at;
    const otra = await request("PATCH", `/api/notifications/${notificacionId}/attend`, { token: tokens.mesero });
    expect(otra.status).toBe(200);
    expect(otra.data.attended_at).toBe(primera);
  });

  it("CP201 - Un mesero no atiende la notificación de otro", async () => {
    const lista = await notis(tokens.mesero2);
    const ajena = lista.pending[0];
    const res = await request("PATCH", `/api/notifications/${ajena.id}/attend`, { token: tokens.mesero });
    expect(res.status).toBe(403);
    expect(messageOf(res)).toContain("no te corresponde");
  });

  it("CP202 - Atender una notificación que no existe", async () => {
    const res = await request("PATCH", "/api/notifications/999999/attend", { token: tokens.mesero });
    expect(res.status).toBe(404);
  });

  it("CP203 - El cocinero y el cajero no consultan notificaciones", async () => {
    expect((await request("GET", "/api/notifications", { token: tokens.cocinero })).status).toBe(403);
    expect((await request("GET", "/api/notifications", { token: tokens.cajero })).status).toBe(403);
  });

  it("CP204 - Sin sesión no se consultan notificaciones", async () => {
    const res = await request("GET", "/api/notifications");
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// HU19 — Visualizar y diferenciar pedidos por tipo de atención
// ═══════════════════════════════════════════════════════════════
describe("HU19 - Visualizar y diferenciar pedidos por tipo de atención", () => {
  let pedidoMesa = 0, pedidoDelivery = 0, pedidoLlevar = 0;
  const historial = (qs = "") => request("GET", `/api/orders/history?date=${lima()}${qs}`, { token: tokens.admin });

  beforeAll(async () => {
    pedidoMesa = await abrirPedido(tokens.mesero, { table_id: 29 });
    pedidoDelivery = await abrirPedido(tokens.cajero, datosDelivery({ delivery_customer_name: "Lucía Paredes" }));
    pedidoLlevar = await abrirPedido(tokens.admin, { modality: "para_llevar", delivery_customer_name: "Mario Díaz" });
  });

  it("CP205 - El listado muestra la modalidad de cada pedido", async () => {
    const res = await historial();
    expect(res.status).toBe(200);
    for (const o of res.data.orders) expect(["mesa", "delivery", "para_llevar"]).toContain(o.modality);
    const por = (id: number) => res.data.orders.find((o: any) => o.id === id).modality;
    expect(por(pedidoMesa)).toBe("mesa");
    expect(por(pedidoDelivery)).toBe("delivery");
    expect(por(pedidoLlevar)).toBe("para_llevar");
  });

  it("CP206 - Filtrar por modalidad Mesa", async () => {
    const res = await historial("&modality=mesa");
    expect(res.status).toBe(200);
    expect(res.data.orders.length).toBeGreaterThan(0);
    expect(res.data.orders.every((o: any) => o.modality === "mesa")).toBe(true);
    expect(res.data.orders.map((o: any) => o.id)).toContain(pedidoMesa);
  });

  it("CP207 - Filtrar por modalidad Delivery", async () => {
    const res = await historial("&modality=delivery");
    expect(res.status).toBe(200);
    expect(res.data.orders.every((o: any) => o.modality === "delivery")).toBe(true);
    const ids = res.data.orders.map((o: any) => o.id);
    expect(ids).toContain(pedidoDelivery);
    expect(ids).not.toContain(pedidoMesa);
  });

  it("CP208 - Filtrar pedidos fuera de mesa (Delivery y Para llevar)", async () => {
    const res = await historial("&modality=offsite");
    const ids = res.data.orders.map((o: any) => o.id);
    expect(ids).toContain(pedidoDelivery);
    expect(ids).toContain(pedidoLlevar);
    expect(ids).not.toContain(pedidoMesa);
  });

  it("CP209 - El resumen se recalcula según el filtro elegido", async () => {
    const res = await historial("&modality=mesa");
    expect(res.data.summary.count).toBe(res.data.orders.length);
  });

  it("CP210 - El detalle de un pedido de Mesa muestra la modalidad y la mesa", async () => {
    const res = await request("GET", `/api/orders/${pedidoMesa}`, { token: tokens.admin });
    expect(res.data.modality).toBe("mesa");
    expect(res.data.table.number).toBe(29);
  });

  it("CP211 - El detalle de un pedido Delivery muestra la modalidad y no tiene mesa", async () => {
    const res = await request("GET", `/api/orders/${pedidoDelivery}`, { token: tokens.admin });
    expect(res.data.modality).toBe("delivery");
    expect(res.data.table).toBeNull();
    expect(res.data.delivery_address).toBe("Av. Perú 123");
  });

  it("CP212 - El listado general de pedidos también filtra por modalidad", async () => {
    const res = await request("GET", "/api/orders?modality=delivery", { token: tokens.admin });
    expect(res.status).toBe(200);
    expect(res.data.every((o: any) => o.modality === "delivery")).toBe(true);
  });

  it("CP213 - El cajero solo ve pedidos fuera de mesa en el listado general", async () => {
    const res = await request("GET", "/api/orders", { token: tokens.cajero });
    expect(res.data.every((o: any) => o.modality !== "mesa")).toBe(true);
    expect(res.data.map((o: any) => o.id)).toContain(pedidoDelivery);
  });

  it("CP214 - El mesero y el cajero no acceden al historial administrativo", async () => {
    expect((await request("GET", "/api/orders/history", { token: tokens.mesero })).status).toBe(403);
    expect((await request("GET", "/api/orders/history", { token: tokens.cajero })).status).toBe(403);
  });

  it("CP215 - Sin sesión no se consulta el historial", async () => {
    const res = await request("GET", "/api/orders/history");
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// HU22 — Consultar el historial de ventas
// ═══════════════════════════════════════════════════════════════
describe("HU22 - Consultar el historial de ventas", () => {
  let platoId = 0;
  let confirmado = 0, cerrado = 0, cancelado = 0, edicion = 0;
  let codigoConfirmado = "";
  const hoy = lima();
  const historial = (qs: string, token = tokens.admin) => request("GET", `/api/orders/history${qs}`, { token });
  const delivery = (n: string) => datosDelivery({ delivery_customer_name: n });

  beforeAll(async () => {
    const cat = await crearCategoria("Cat HU22");
    const ing = await crearIngrediente("Insumo HU22", 100);
    platoId = await crearPlato("Plato HU22", 20, cat, [{ ingrediente: ing, cantidad: 0.1 }]);

    confirmado = await abrirPedido(tokens.admin, delivery("Cliente Confirmado"));
    await agregarPlato(tokens.admin, confirmado, platoId, 2); // 40.00
    codigoConfirmado = (await confirmarPedido(tokens.admin, confirmado)).pedido.code;

    cerrado = await abrirPedido(tokens.admin, delivery("Cliente Cerrado"));
    await agregarPlato(tokens.admin, cerrado, platoId, 3); // 60.00
    await confirmarPedido(tokens.admin, cerrado);
    await request("PATCH", `/api/orders/${cerrado}/paid`, { token: tokens.admin, body: { paid: true } });
    const cierre = await request("POST", `/api/orders/${cerrado}/close`, { token: tokens.admin });
    if (cierre.status !== 200) throw new Error(`Cierre: ${JSON.stringify(cierre)}`);

    cancelado = await abrirPedido(tokens.admin, delivery("Cliente Cancelado"));
    await agregarPlato(tokens.admin, cancelado, platoId, 1); // 20.00
    await confirmarPedido(tokens.admin, cancelado);
    await request("POST", `/api/orders/${cancelado}/cancel`, { token: tokens.admin, body: { reason: "Pedido duplicado" } });

    edicion = await abrirPedido(tokens.admin, delivery("Cliente en edición"));
    await agregarPlato(tokens.admin, edicion, platoId, 4); // 80.00
  });

  it("CP216 - Consultar los pedidos de una fecha específica", async () => {
    const res = await historial(`?date=${hoy}`);
    expect(res.status).toBe(200);
    const ids = res.data.orders.map((o: any) => o.id);
    for (const id of [confirmado, cerrado, cancelado, edicion]) expect(ids).toContain(id);
    expect(res.data.from).toBe(hoy);
    expect(res.data.to).toBe(hoy);
  });

  it("CP217 - Consultar los pedidos de un rango de fechas", async () => {
    const hace30 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(Date.now() - 30 * 86400000));
    const res = await historial(`?from=${hace30}&to=${hoy}`);
    expect(res.status).toBe(200);
    expect(res.data.orders.map((o: any) => o.id)).toContain(confirmado);
  });

  it("CP218 - El listado muestra número de pedido, fecha de confirmación, importe y estado", async () => {
    const res = await historial(`?date=${hoy}`);
    const o = res.data.orders.find((x: any) => x.id === confirmado);
    expect(o.code).toBe(codigoConfirmado);
    expect(new Date(o.confirmed_at).getTime()).not.toBeNaN();
    expect(Number(o.total)).toBeCloseTo(40, 2);
    expect(o.status).toBe("confirmado");
  });

  it("CP219 - Una fecha sin pedidos devuelve el listado vacío y total cero", async () => {
    const res = await historial("?date=2020-01-01");
    expect(res.status).toBe(200);
    expect(res.data.orders).toHaveLength(0);
    expect(res.data.summary.count).toBe(0);
    expect(res.data.summary.sales_total).toBe(0);
  });

  it("CP220 - El detalle de cada pedido incluye platos, cantidades, precios y total", async () => {
    const res = await historial(`?date=${hoy}`);
    const o = res.data.orders.find((x: any) => x.id === cerrado);
    expect(o.details).toHaveLength(1);
    expect(o.details[0].dish.name).toBe("Plato HU22");
    expect(o.details[0].quantity).toBe(3);
    expect(Number(o.details[0].unit_price)).toBeCloseTo(20, 2);
    expect(Number(o.total)).toBeCloseTo(60, 2);
  });

  it("CP221 - El resumen suma los importes de los pedidos vendidos del periodo", async () => {
    const res = await historial(`?date=${hoy}`);
    const s = res.data.summary;
    const suma = (estado: string) =>
      res.data.orders.filter((o: any) => o.status === estado).reduce((a: number, o: any) => a + Number(o.total), 0);
    expect(s.sales_total).toBeCloseTo(suma("confirmado") + suma("cerrado"), 2);
    expect(s.sales_total).toBeGreaterThanOrEqual(100);
    expect(s.count).toBe(res.data.orders.length);
  });

  it("CP222 - El resumen separa lo pendiente y lo cancelado de las ventas", async () => {
    const res = await historial(`?date=${hoy}`);
    const s = res.data.summary;
    const suma = (estado: string) =>
      res.data.orders.filter((o: any) => o.status === estado).reduce((a: number, o: any) => a + Number(o.total), 0);
    expect(s.pending_total).toBeCloseTo(suma("en_edicion"), 2);
    expect(s.cancelled_total).toBeCloseTo(suma("cancelado"), 2);
    expect(s.cancelled_total).toBeGreaterThanOrEqual(20);
    for (const estado of ["cerrado", "cancelado", "en_edicion", "confirmado"]) {
      expect(s.by_status[estado].count).toBe(res.data.orders.filter((o: any) => o.status === estado).length);
      expect(s.by_status[estado].count).toBeGreaterThanOrEqual(1);
    }
  });

  it("CP223 - Filtrar por estado: pendientes y completados", async () => {
    const pend = await historial(`?date=${hoy}&status=pendientes`);
    expect(pend.data.orders.every((o: any) => ["en_edicion", "confirmado"].includes(o.status))).toBe(true);
    expect(pend.data.orders.map((o: any) => o.id)).toEqual(expect.arrayContaining([confirmado, edicion]));
    const comp = await historial(`?date=${hoy}&status=completados`);
    expect(comp.data.orders.every((o: any) => o.status === "cerrado")).toBe(true);
    expect(comp.data.orders.map((o: any) => o.id)).toContain(cerrado);
  });

  it("CP224 - Filtrar por estado cancelado", async () => {
    const res = await historial(`?date=${hoy}&status=cancelado`);
    expect(res.data.orders.every((o: any) => o.status === "cancelado")).toBe(true);
    expect(res.data.orders.map((o: any) => o.id)).toContain(cancelado);
  });

  it("CP225 - Sin parámetros se consulta el día de hoy", async () => {
    const res = await historial("");
    expect(res.status).toBe(200);
    expect(res.data.from).toBe(hoy);
    expect(res.data.orders.map((o: any) => o.id)).toContain(confirmado);
  });

  it("CP226 - Fecha con formato incorrecto", async () => {
    const res = await historial("?date=20-11-2026");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("AAAA-MM-DD");
  });

  it("CP227 - Fecha que no existe en el calendario", async () => {
    const res = await historial("?date=2026-02-30");
    expect(res.status).toBe(400);
  });

  it("CP228 - La fecha inicial no puede ser mayor que la final", async () => {
    const res = await historial("?from=2026-11-20&to=2026-11-01");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("no puede ser mayor");
  });

  it("CP229 - El rango no puede superar un año", async () => {
    const res = await historial("?from=2024-01-01&to=2026-01-01");
    expect(res.status).toBe(400);
    expect(messageOf(res)).toContain("un año");
  });

  it("CP230 - El detalle de platos vendidos no incluye pedidos cancelados ni en edición", async () => {
    const res = await request("GET", "/api/orders/sales", { token: tokens.admin });
    expect(res.status).toBe(200);
    const ids = res.data.map((d: any) => d.order_id);
    expect(ids).toContain(confirmado);
    expect(ids).toContain(cerrado);
    expect(ids).not.toContain(cancelado);
    expect(ids).not.toContain(edicion);
    const fila = res.data.find((d: any) => d.order_id === confirmado);
    expect(fila.dish_name).toBe("Plato HU22");
    expect(fila.quantity).toBe(2);
    expect(fila.unit_price).toBeCloseTo(20, 2);
    expect(fila.total).toBeCloseTo(40, 2);
  });

  it("CP231 - El mesero y el cajero no consultan el historial de ventas", async () => {
    expect((await historial(`?date=${hoy}`, tokens.mesero)).status).toBe(403);
    expect((await historial(`?date=${hoy}`, tokens.cajero)).status).toBe(403);
  });

  it("CP232 - Sin sesión no se consulta el historial de ventas", async () => {
    const res = await request("GET", `/api/orders/history?date=${hoy}`);
    expect(res.status).toBe(401);
  });
});
