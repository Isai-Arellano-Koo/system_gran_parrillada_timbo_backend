import { Router } from "express";
import {
  confirmEmailHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  registerHandler,
  resendConfirmEmailHandler,
} from "../../handlers/auth/auth.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.post("/login", loginHandler); // sin token: cualquiera puede intentar entrar
router.post("/confirm-email", confirmEmailHandler);
router.post("/confirm-email/resend", resendConfirmEmailHandler);
router.post("/register", authMiddleware, requireRoles("admin"), registerHandler);
router.get("/me", authMiddleware, getMeHandler);
router.post("/logout", authMiddleware, logoutHandler);

export default router;
