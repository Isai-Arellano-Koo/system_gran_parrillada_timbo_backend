import { Router } from "express";
import {
  attendWaiterNotificationHandler,
  listWaiterNotificationsHandler,
} from "../../handlers/notifications/notification.handlers";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { requireRoles } from "../../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware);
router.get(
  "/",
  requireRoles("mesero", "admin"),
  listWaiterNotificationsHandler
);
router.patch(
  "/:notificationId/attend",
  requireRoles("mesero", "admin"),
  attendWaiterNotificationHandler
);

export default router;
