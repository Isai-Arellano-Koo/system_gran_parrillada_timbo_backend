import { Router } from "express";
import {
  confirmEmailHandler,
  confirmPasswordResetHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  registerHandler,
  requestPasswordResetHandler,
  resendConfirmEmailHandler,
} from "../../handlers/auth/auth.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.post("/login", loginHandler); // sin token: cualquiera puede intentar entrar
router.post("/confirm-email", confirmEmailHandler);
router.post("/confirm-email/resend", resendConfirmEmailHandler);
router.post("/password-reset", requestPasswordResetHandler);
router.post("/password-reset/confirm", confirmPasswordResetHandler);
router.post("/register", authMiddleware, requireRoles("admin"), registerHandler);
router.get("/me", authMiddleware, getMeHandler);
router.post("/logout", authMiddleware, logoutHandler);

export default router;
