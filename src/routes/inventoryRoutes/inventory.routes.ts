import { Router } from "express";
import {
  registerStockEntryHandler,
  listMovementsHandler,
  listLowStockAlertsHandler,
} from "../../handlers/inventory/inventory.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles("admin"));

router.post("/entries", registerStockEntryHandler);
router.get("/movements", listMovementsHandler);
router.get("/alerts", listLowStockAlertsHandler);

export default router;
