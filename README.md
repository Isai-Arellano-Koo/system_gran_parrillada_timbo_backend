# Backend — Gran Parrillada Timbó

API REST con **Node.js + Express + TypeScript + Sequelize + PostgreSQL**.

## Estructura (mismo enfoque que APP-FAMILYCARE)

```
src/
  config/          # env + conexión Sequelize
  models/          # entidades del dominio
  controllers/     # lógica de negocio
  handlers/        # capa HTTP (req/res)
  routes/          # definición de endpoints
  middlewares/     # auth, roles, errores
  helpers/         # JWT, bcrypt
  types/           # tipos Express y enums
  scripts/         # utilidades (sync DB)
  app.ts
  index.ts
```

Flujo: `routes → handlers → controllers → models`

## Módulos alineados al Product Backlog

| Ruta | Épica | HUs |
|------|--------|-----|
| `/api/auth` | EP01 Usuarios | HU01 |
| `/api/catalog` | EP02 Catálogo y recetas | HU02, HU04, HU05 |
| `/api/inventory` | EP03 / EP06 Inventario | HU03, HU14, HU15 |
| `/api/orders` | EP04 Pedidos | HU06–HU09, HU13 |
| `/api/kitchen` | EP05 Cocina | HU10–HU11 |

## Arranque local

1. Copiar `.env.example` a `.env` y configurar PostgreSQL.
2. `npm install`
3. Crear la base `gran_parrillada_timbo` en Postgres.
4. En desarrollo puedes usar `DB_SYNC=true` o `npm run db:sync`.
5. `npm run dev`

Auth listo (login/register/me). El resto de endpoints están esqueletados y responden `501` hasta implementar cada HU.
# system_gran_parrillada_timbo_backend
