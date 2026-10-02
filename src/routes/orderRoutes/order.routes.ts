import { Router } from "express";
import {
  openOrderHandler,
  addOrderDetailHandler,
  removeOrderDetailHandler,
  validateStockHandler,
  confirmOrderHandler,
  cancelOrderHandler,
  listOrdersHandler,
  getOrderHandler,
  listTablesHandler,
  seedTablesHandler,
} from "../../handlers/orders/order.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/tables", listTablesHandler);
router.post("/tables/seed", requireRoles("admin"), seedTablesHandler);

router.get("/", requireRoles("mesero", "admin", "cocinero"), listOrdersHandler);
router.get(
  "/:orderId",
  requireRoles("mesero", "admin", "cocinero"),
  getOrderHandler
);
router.post("/", requireRoles("mesero", "admin"), openOrderHandler);
router.post(
  "/:orderId/details",
  requireRoles("mesero", "admin"),
  addOrderDetailHandler
);
router.delete(
  "/:orderId/details/:detailId",
  requireRoles("mesero", "admin"),
  removeOrderDetailHandler
);
router.post(
  "/:orderId/validate-stock",
  requireRoles("mesero", "admin"),
  validateStockHandler
);
router.post(
  "/:orderId/confirm",
  requireRoles("mesero", "admin"),
  confirmOrderHandler
);
router.post(
  "/:orderId/cancel",
  requireRoles("admin", "mesero"),
  cancelOrderHandler
);

export default router;
