import { Router } from "express";
import {
  listKitchenTicketsHandler,
  updateKitchenStatusHandler,
  updateKitchenDishHandler,
} from "../../handlers/kitchen/kitchen.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requireRoles("cocinero", "admin", "mesero"),
  listKitchenTicketsHandler
);
router.patch(
  "/details/:detailId/status",
  requireRoles("cocinero", "admin", "mesero"),
  updateKitchenDishHandler
);
router.patch(
  "/:ticketId/status",
  requireRoles("cocinero", "admin"),
  updateKitchenStatusHandler
);

export default router;
