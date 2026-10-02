export const USER_ROLES = ["admin", "mesero", "cocinero"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEASUREMENT_UNITS = ["kg", "g", "lt", "ml", "unidad"] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const ORDER_STATUSES = [
  "en_edicion",
  "confirmado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const KITCHEN_STATUSES = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const INVENTORY_MOVEMENT_TYPES = [
  "entrada",
  "salida_venta",
  "devolucion",
  "ajuste",
  "merma",
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];
