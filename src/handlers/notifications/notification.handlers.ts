import { Request, Response } from "express";
import {
  attendWaiterNotificationController,
  listWaiterNotificationsController,
} from "../../controllers/notifications/notification.controller";
import { AppError } from "../../middlewares/errorHandler";

const handle = async (
  res: Response,
  action: () => Promise<unknown>,
  successStatus = 200
) => {
  try {
    const result = await action();
    return res.status(successStatus).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: true,
        message: error.message,
      });
    }
    console.error(error);
    return res.status(500).json({ error: true, message: "Error interno" });
  }
};

export const listWaiterNotificationsHandler = (req: Request, res: Response) =>
  handle(res, () =>
    listWaiterNotificationsController(req.user!.id, req.user!.role)
  );

export const attendWaiterNotificationHandler = (req: Request, res: Response) =>
  handle(res, () =>
    attendWaiterNotificationController(
      Number(req.params.notificationId),
      req.user!.id,
      req.user!.role
    )
  );
