# Gran Parrillada Timbó — Backend (API REST)

API REST del sistema de gestión de pedidos, cocina e inventario de **Gran Parrillada Timbó**, restaurante de parrillas de 30 mesas. Proyecto del curso *Proyecto Tecnológico* (ISIL, NRC 3710), desarrollado con Scrum.

El sistema reemplaza las comandas manuscritas y el control de inventario en Excel por un flujo digital: el mesero registra el pedido, cocina recibe la comanda y el inventario se descuenta según la receta de cada plato.

- Frontend: https://github.com/Isai-Arellano-Koo/system_gran_parrillada_timbo_frontend
- Tablero Scrum (Trello): https://trello.com/b/8duBXs5H/project-gran-parrillada-timbo
- Diseños (Figma): https://www.figma.com/design/HFS3KQvvDFlRI30mvj2E5v/Gran-Parrillada-Timbo?node-id=2-2
- API desplegada (Railway): https://systemgranparrilladatimbobackend-production.up.railway.app/

## Alcance por sprint

| Sprint | Historias | Funcionalidad |
|---|---|---|
| Sprint 1 | HU16, HU01, HU02, HU03 | Registro de usuarios por rol, inicio de sesión, ingredientes, stock inicial y entradas |
| Siguientes | HU04 a HU15 | Platos y recetas, pedidos, comandas, descuento de inventario, cancelaciones, movimientos y alertas |

El repositorio ya incluye código de módulos de sprints posteriores (platos, recetas, pedidos, cocina, ajustes y alertas). Su validación formal contra los criterios de aceptación se hace en el sprint que corresponda, según el Product Backlog.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Entorno | Node.js + TypeScript |
| Framework | Express 5 |
| Base de datos | PostgreSQL con Sequelize (ORM) |
| Autenticación | JWT (`jsonwebtoken`) |
| Contraseñas | Hash con `bcrypt` (12 rondas de sal) |
| Correo de verificación | API HTTPS de Brevo |
| Registro de peticiones | morgan |
| Pruebas | Vitest |
| Desarrollo | tsx + nodemon |
| Despliegue | Railway |

## Requisitos previos

- Node.js 20 o superior `
- PostgreSQL local, o la base de datos de Railway
- Cuenta de Brevo con remitente verificado (solo para el envío del código por correo)

## Instalación y ejecución local

```bash
# 1. Clonar e instalar
git clone https://github.com/Isai-Arellano-Koo/system_gran_parrillada_timbo_backend.git
cd system_gran_parrillada_timbo_backend
npm install

# 2. Variables de entorno
cp .env.example .env
# editar .env (ver tabla más abajo)

# 3. Crear la base de datos vacía en PostgreSQL
#    (nombre por defecto: gran_parrillada_timbo)

# 4. Crear/actualizar las tablas
npm run db:sync

# 5. Cargar datos iniciales (usuarios, 30 mesas, categorías y carta)
npm run db:seed

# Vaciar la base y volver a cargar la semilla (incluye la carta de setiembre 2026)
npm run db:reset

# 6. Levantar el servidor
npm run dev
```

El servidor queda en `http://localhost:3000`. Para comprobar que funciona: `GET /api/health`.

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno | `development` |
| `DATABASE_URL` | Cadena de conexión completa. Si está definida, tiene prioridad sobre `DB_*` | vacío |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión por partes | `localhost`, `5432`, `gran_parrillada_timbo`, `postgres`, `postgres` |
| `DB_DIALECT` | Dialecto | `postgres` |
| `DB_SSL` | `true` para el proxy público de Railway (`*.proxy.rlwy.net`) | `false` |
| `DB_SYNC` | `true` solo en desarrollo para crear/alterar tablas automáticamente | `false` |
| `DB_LOGGING` | Muestra las consultas SQL | `false` |
| `JWT_SECRET` | Clave para firmar los tokens. **Debe cambiarse siempre** | — |
| `JWT_EXPIRES_IN` | Duración del token | `8h` |
| `CORS_ORIGIN` | Origen permitido (URL del frontend) | `http://localhost:5173` |
| `BREVO_API_KEY` | Clave de la API de Brevo | vacío |
| `BREVO_SENDER` | Remitente verificado en Brevo | vacío |

El archivo `.env` está en `.gitignore` y nunca debe subirse al repositorio.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en desarrollo con recarga automática |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta la versión compilada (producción) |
| `npm run db:sync` | Sincroniza los modelos con la base de datos |
| `npm run db:seed` | Crea usuarios de prueba, 30 mesas, categorías y la carta | 
| `npm run db:reset` | Vacía la base de datos y vuelve a cargar la semilla |
| `npm test` | Ejecuta las pruebas con Vitest |

## Usuarios de prueba (solo desarrollo)

El comando `npm run db:seed` crea tres usuarios: `admin`, `mesero` y `cocinero`. Sus correos y contraseñas iniciales están en `src/scripts/seed.ts`. **No usar estas credenciales en un entorno real**: cámbialas o elimina los usuarios antes de usar el sistema con datos del restaurante.

## Roles

| Rol | Permisos principales |
|---|---|
| `admin` | Control total: usuarios, catálogo, inventario, pedidos y cocina |
| `mesero` | Abre y gestiona pedidos; consulta comandas |
| `cocinero` | Consulta y actualiza el estado de las comandas |
| `cajero` | Rol disponible para consulta del resumen del local |

## Endpoints

Todas las rutas empiezan con `/api`. Salvo las públicas, requieren el encabezado `Authorization: Bearer <token>`.

**Salud y autenticación (HU01, HU16)**

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/health` | Estado del servicio | Público |
| POST | `/api/auth/login` | Inicio de sesión con correo o nombre de usuario | Público |
| POST | `/api/auth/confirm-email` | Confirma el correo con el código recibido | Público |
| POST | `/api/auth/confirm-email/resend` | Reenvía el código | Público |
| POST | `/api/auth/register` | Registra un usuario con rol | admin |
| GET | `/api/auth/me` | Datos de la sesión actual | Autenticado |
| POST | `/api/auth/logout` | Cierra sesión | Autenticado |

**Usuarios (HU16)** — solo `admin`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users` | Lista usuarios |
| POST | `/api/users` | Crea usuario |
| GET | `/api/users/:id` | Detalle de usuario |
| PATCH | `/api/users/:id` | Modifica rol o activa/desactiva |

**Catálogo (HU02, HU04, HU05)**

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/catalog/categories` | Lista categorías | Autenticado |
| POST | `/api/catalog/categories` | Crea o reactiva una categoría | admin |
| PATCH | `/api/catalog/categories/:id` | Renombra o reactiva | admin |
| DELETE | `/api/catalog/categories/:id` | Quita la categoría e inhabilita sus platos | admin |
| GET | `/api/catalog/ingredients` | Lista ingredientes | Autenticado |
| POST | `/api/catalog/ingredients` | Crea ingrediente | admin |
| PATCH | `/api/catalog/ingredients/:id` | Modifica o activa/desactiva | admin |
| GET | `/api/catalog/dishes` | Lista platos | Autenticado |
| POST | `/api/catalog/dishes` | Crea plato (requiere categoría activa) | admin |
| PATCH | `/api/catalog/dishes/:id` | Modifica o activa/desactiva | admin |
| PUT | `/api/catalog/dishes/:dishId/recipe` | Define la receta del plato | admin |

**Inventario (HU03, HU12 a HU15)** — solo `admin`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/inventory/entries` | Registra stock inicial o entrada |
| POST | `/api/inventory/adjustments` | Registra un ajuste |
| GET | `/api/inventory/movements` | Lista movimientos |
| GET | `/api/inventory/alerts` | Ingredientes en stock mínimo |

**Pedidos (HU06 a HU09, HU13)**

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/orders/tables` | Lista mesas | Autenticado |
| POST | `/api/orders/tables/seed` | Crea las mesas | admin |
| GET | `/api/orders` | Lista pedidos | mesero, admin, cocinero |
| GET | `/api/orders/:orderId` | Detalle del pedido | mesero, admin, cocinero |
| POST | `/api/orders` | Abre un pedido para una mesa | mesero, admin |
| POST | `/api/orders/:orderId/details` | Agrega plato, cantidad y observación | mesero, admin |
| DELETE | `/api/orders/:orderId/details/:detailId` | Elimina un detalle | mesero, admin |
| POST | `/api/orders/:orderId/validate-stock` | Valida disponibilidad de ingredientes | mesero, admin |
| POST | `/api/orders/:orderId/confirm` | Confirma el pedido | mesero, admin |
| POST | `/api/orders/:orderId/cancel` | Cancela el pedido con motivo | admin, mesero |

**Cocina (HU10, HU11)**

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/kitchen` | Lista comandas | cocinero, admin, mesero |
| PATCH | `/api/kitchen/:ticketId/status` | Cambia el estado de la comanda | cocinero, admin |

## Estados y tipos definidos

| Concepto | Valores |
|---|---|
| Unidades de medida | `kg`, `g`, `lt`, `ml`, `unidad` |
| Estado del pedido | `en_edicion`, `confirmado`, `cancelado` |
| Estado de la comanda | `pendiente`, `en_preparacion`, `listo`, `entregado` |
| Tipos de movimiento de inventario | `entrada`, `salida_venta`, `devolucion`, `ajuste`, `merma` |

## Modelo de datos

| Tabla | Propósito |
|---|---|
| `users` | Colaboradores: rol, estado activo, correo verificado, contraseña hasheada |
| `email_verifications` | Códigos de confirmación de correo (guardados como hash, con vencimiento y uso) |
| `ingredients` | Insumos: unidad, stock actual, stock mínimo, estado |
| `categories` | Categorías de la carta; al quitarlas se inhabilitan sus platos |
| `dishes` | Platos del menú: categoría, presentación, precio, descripción, estado |
| `recipe_items` | Ingredientes y cantidades de cada plato |
| `tables` | Las 30 mesas del salón |
| `orders` | Pedidos: mesa, mesero, estado, total, motivo de cancelación |
| `order_details` | Platos de cada pedido: cantidad, precio unitario y observación |
| `kitchen_tickets` | Comandas: estado y quién lo cambió |
| `inventory_movements` | Historial de movimientos: ingrediente, tipo, cantidad, motivo, pedido y usuario |

`[Adjuntar el diagrama entidad-relación en /docs]`

## Estructura del proyecto

```
src/
├── config/        # Entorno y conexión a la base de datos
├── routes/        # Definición de rutas por módulo
├── controllers/   # Controladores por módulo
├── handlers/      # Lógica de cada endpoint
├── middlewares/   # Autenticación, roles y manejo de errores
├── models/        # Modelos de Sequelize
├── helpers/       # Hash de contraseñas, tokens y correo
├── scripts/       # syncDb y seed
├── types/         # Enumeraciones y tipos
├── app.ts         # Configuración de Express
└── index.ts       # Arranque del servidor
test/              # Pruebas (api.test.ts, mail.test.ts)
```

## Seguridad

- Las contraseñas se guardan con hash `bcrypt`, nunca en texto plano.
- Autenticación con JWT y control de acceso por rol en cada ruta.
- La cuenta se activa al confirmar el correo con un código de 15 minutos, enviado por Brevo.
- Un administrador no puede cambiar su propio rol ni desactivarse.
- CORS limitado al origen configurado en `CORS_ORIGIN`.

## Pruebas

```bash
npm test
```

Incluye pruebas de API (login con correo y usuario, registro y permisos por rol, validación de ingredientes y de stock, entradas, movimientos y alertas, confirmación de correo) y pruebas del envío de correo con Brevo.

Las pruebas de API **necesitan una base de datos separada**: defina `TEST_DATABASE_URL` en un archivo `.env.test` (no se sube al repositorio). Si apunta a la misma base que `DATABASE_URL`, las pruebas se detienen para proteger los datos reales.

## Despliegue en Railway

1. Crear el servicio desde el repositorio de GitHub y agregar una base de datos PostgreSQL.
2. Configurar las variables de entorno en el panel de Railway (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` con la URL del frontend, `BREVO_API_KEY`, `BREVO_SENDER`).
3. Usar `DB_SSL=true` si se conecta por el proxy público.
4. Comandos: build `npm run build`, inicio `npm start`.

## Por qué lo hicimos así

| Decisión | Motivo |
|---|---|
| Contraseñas con `bcrypt` (12 rondas) | Definimos la tecnología de hash en el tablero (incidencia de Trello) y elegimos una librería ampliamente usada; nunca guardamos contraseñas en texto plano. |
| Login con correo **o** nombre de usuario | Al principio solo entraba con correo. Lo corregimos porque el personal del restaurante usa su usuario en el día a día (pruebas CP01 y CP02). |
| Código de verificación por correo, guardado como hash y con vencimiento de 15 minutos | Queremos confirmar que el correo del colaborador existe sin dejar el código legible en la base de datos. |
| Envío de correo con la API HTTPS de Brevo en lugar de SMTP | La elegimos porque permite enviar los códigos de verificación mediante una API HTTPS, sin tener que configurar y mantener un servidor SMTP propio. Así, la integración del correo queda más sencilla para el proyecto. |
| Un administrador no puede cambiar su propio rol ni desactivarse | Evita que el sistema se quede sin administrador por un error (CP14 y CP15). |
| Pruebas con una base de datos separada | Las pruebas se detienen si apuntan a la base real, para no borrar datos del restaurante por accidente. |
| Stock con 3 decimales | Los insumos de una parrilla se manejan en kilos, gramos y litros, no solo en unidades enteras. |
| Rol `cajero` incorporado al modelo | Surgió como incidencia en el tablero; hoy existe en el sistema y en las pruebas. |

## Dificultades que tuvimos

- **Inicio de sesión solo por correo:** lo detectamos al probar y lo resolvimos aceptando también el nombre de usuario.
- **Tecnología de hash sin definir:** quedó registrada como incidencia y se cerró al adoptar `bcrypt`.
- **Pedidos múltiples por mesa (HU06):** se validó con el Product Owner si el restaurante lo permite. ``


## Cómo demostrar el Sprint 1

1. Iniciar sesión como `admin`.
2. Registrar un usuario nuevo con rol mesero (HU16) y revisar que pide confirmar el correo.
3. Cerrar sesión e ingresar con ese usuario por nombre de usuario y por correo (HU01).
4. Como admin, registrar un ingrediente de la parrilla, por ejemplo un corte de carne en `kg` (HU02).
5. Registrar el stock inicial y una entrada posterior (HU03).
6. Consultar los movimientos y comprobar que quedaron el tipo, la cantidad y el usuario.

## Pendiente y limitaciones

- Faltan por marcar en Trello las validaciones finales del Product Owner de HU16, HU01, HU02 y HU03.
- Los módulos de pedidos, cocina y recetas existen en el código pero se validan formalmente en los siguientes sprints.


## Equipo

| Integrante | Rol Scrum | Aporte |
|---|---|---|
| Mateo Alejandro Goto Gusukuda | Product Owner | Gestión, priorización y validación del Product Backlog |
| Alessandro Del Piero Chavarria Medina | Scrum Master / Developer | Facilitación de Scrum, seguimiento del tablero y README |
| Isai Kaleb Arellano Koo | Developer | Desarrollo del backend y del frontend (código y base de datos) |
| Paul Marcelo Challco Peña | Integrator / UX-UI | Informe técnico y documentación |
| Victor Samir Huallpa Alvites | Developer | |

## Uso de herramientas de IA

Las herramientas de IA empleadas y las partes del código donde se usaron se declaran en el **Anexo A** del informe técnico. Todo el código asistido fue revisado, probado y adaptado por el equipo.
