import { Router } from "express";
import {
  createUserHandler,
  getUserHandler,
  listUsersHandler,
  listUserStatusChangesHandler,
  updateUserHandler,
} from "../../handlers/users/user.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware, requireRoles("admin")); // solo el admin gestiona cuentas // solo el admin gestiona cuentas
router.get("/", listUsersHandler);
router.post("/", createUserHandler);
router.get("/:id/status-changes", listUserStatusChangesHandler);
router.get("/:id", getUserHandler);
router.patch("/:id", updateUserHandler);

export default router;
