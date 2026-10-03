import { Request, Response } from "express";
import {
  registerStockEntryController,
  adjustStockController,
  listMovementsController,
  listLowStockAlertsController,
} from "../../controllers/inventory/inventory.controller";
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

export const registerStockEntryHandler = (req: Request, res: Response) =>
  handle(
    res,
    () => registerStockEntryController(req.body, req.user!.id),
    201
  );

export const adjustStockHandler = (req: Request, res: Response) =>
  handle(res, () => adjustStockController(req.body, req.user!.id));

export const listMovementsHandler = (_req: Request, res: Response) =>
  handle(res, () => listMovementsController());

export const listLowStockAlertsHandler = (_req: Request, res: Response) =>
  handle(res, () => listLowStockAlertsController());
