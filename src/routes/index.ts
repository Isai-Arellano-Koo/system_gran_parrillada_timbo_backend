import { Router } from "express";
import healthRoutes from "./healthRoutes/health.routes";
import authRoutes from "./authRoutes/auth.routes";
import catalogRoutes from "./catalogRoutes/catalog.routes";
import inventoryRoutes from "./inventoryRoutes/inventory.routes";
import orderRoutes from "./orderRoutes/order.routes";
import kitchenRoutes from "./kitchenRoutes/kitchen.routes";
import userRoutes from "./userRoutes/user.routes";

const router = Router();

router.use("/api/health", healthRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/catalog", catalogRoutes);
router.use("/api/inventory", inventoryRoutes);
router.use("/api/orders", orderRoutes);
router.use("/api/kitchen", kitchenRoutes);
router.use("/api/users", userRoutes);

export default router;
