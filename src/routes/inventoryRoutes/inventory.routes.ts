import { Router } from "express";
import {
  registerStockEntryHandler,
  adjustStockHandler,
  listMovementsHandler,
  listLowStockAlertsHandler,
  rejectDeleteMovementHandler,
  reviewMermaHandler,
} from "../../handlers/inventory/inventory.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles("admin")); // stock solo lo mueve administración

router.post("/entries", registerStockEntryHandler);
router.post("/adjustments", adjustStockHandler);
router.get("/movements", listMovementsHandler);
router.post("/movements/:id/review", reviewMermaHandler);
router.delete("/movements/:id", rejectDeleteMovementHandler);
router.get("/alerts", listLowStockAlertsHandler);

export default router;
