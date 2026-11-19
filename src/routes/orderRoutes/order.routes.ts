import { Router } from "express";
import {
  openOrderHandler,
  joinTablesHandler,
  splitTableHandler,
  addOrderDetailHandler,
  removeOrderDetailHandler,
  updateOrderDetailHandler,
  validateStockHandler,
  confirmOrderHandler,
  cancelOrderHandler,
  returnOrderDetailHandler,
  closeOrderHandler,
  sendAdditionsHandler,
  setOrderPaidHandler,
  listOrdersHandler,
  listSoldDishesHandler,
  getOrderHandler,
  listTablesHandler,
  seedTablesHandler,
  setTableActiveHandler,
  groupTablesHandler,
  ungroupTablesHandler,
  listTableChangesHandler,
} from "../../handlers/orders/order.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware); // pedidos solo con sesión

router.get("/tables", listTablesHandler);
router.post("/tables/seed", requireRoles("admin"), seedTablesHandler);
router.get(
  "/tables/changes",
  requireRoles("admin"),
  listTableChangesHandler
);
router.post(
  "/tables/groups",
  requireRoles("admin", "mesero"),
  groupTablesHandler
);
router.delete(
  "/tables/groups/:groupId",
  requireRoles("admin", "mesero"),
  ungroupTablesHandler
);
router.patch(
  "/tables/:tableId",
  requireRoles("admin"),
  setTableActiveHandler
);

router.get("/", requireRoles("mesero", "admin", "cocinero", "cajero"), listOrdersHandler);
router.post(
  "/join-tables",
  requireRoles("mesero", "admin"),
  joinTablesHandler
);
router.post(
  "/split-table",
  requireRoles("mesero", "admin"),
  splitTableHandler
);
router.get(
  "/sales",
  requireRoles("admin", "cajero"),
  listSoldDishesHandler
);
router.get(
  "/:orderId",
  requireRoles("mesero", "admin", "cocinero", "cajero"),
  getOrderHandler
);
router.post("/", requireRoles("mesero", "admin", "cajero"), openOrderHandler);
router.post(
  "/:orderId/details",
  requireRoles("mesero", "admin", "cajero"),
  addOrderDetailHandler
);
router.patch(
  "/:orderId/details/:detailId",
  requireRoles("mesero", "admin", "cajero"),
  updateOrderDetailHandler
);
router.delete(
  "/:orderId/details/:detailId",
  requireRoles("mesero", "admin", "cajero"),
  removeOrderDetailHandler
);
router.post(
  "/:orderId/validate-stock",
  requireRoles("mesero", "admin", "cajero"),
  validateStockHandler
);
router.post(
  "/:orderId/confirm",
  requireRoles("mesero", "admin", "cajero"),
  confirmOrderHandler
);
router.post(
  "/:orderId/additions",
  requireRoles("mesero", "admin", "cajero"),
  sendAdditionsHandler
);
router.patch(
  "/:orderId/paid",
  requireRoles("mesero", "admin", "cajero"),
  setOrderPaidHandler
);
router.post(
  "/:orderId/close",
  requireRoles("mesero", "admin", "cajero"),
  closeOrderHandler
);
router.post(
  "/:orderId/cancel",
  requireRoles("admin", "mesero", "cajero"),
  cancelOrderHandler
);
router.post(
  "/:orderId/details/:detailId/return",
  requireRoles("admin", "mesero", "cajero"),
  returnOrderDetailHandler
);

export default router;
