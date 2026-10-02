import { Request, Response } from "express";
import {
  listKitchenTicketsController,
  updateKitchenStatusController,
} from "../../controllers/kitchen/kitchen.controller";
import { AppError } from "../../middlewares/errorHandler";
import type { KitchenStatus } from "../../types/enums";

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

export const listKitchenTicketsHandler = (_req: Request, res: Response) =>
  handle(res, () => listKitchenTicketsController());

export const updateKitchenStatusHandler = (req: Request, res: Response) =>
  handle(res, () =>
    updateKitchenStatusController(
      Number(req.params.ticketId),
      req.body.status as KitchenStatus,
      req.user!.id
    )
  );
