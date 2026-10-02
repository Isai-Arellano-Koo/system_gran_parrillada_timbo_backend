import { Router } from "express";
import {
  loginHandler,
  registerHandler,
  getMeHandler,
  logoutHandler,
} from "../../handlers/auth/auth.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.post("/login", loginHandler);
router.post("/register", authMiddleware, requireRoles("admin"), registerHandler);
router.get("/me", authMiddleware, getMeHandler);
router.post("/logout", authMiddleware, logoutHandler);

export default router;
