import { Request, Response } from "express";
import {
  registerStockEntryController,
  adjustStockController,
  listMovementsController,
  listLowStockAlertsController,
  rejectDeleteMovementController,
  reviewMermaController,
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

export const listMovementsHandler = (req: Request, res: Response) =>
  handle(res, () =>
    listMovementsController({
      ingredient_id: String(req.query.ingredient_id || ""),
      type: String(req.query.type || ""),
      user_id: String(req.query.user_id || ""),
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
    })
  );

export const rejectDeleteMovementHandler = (_req: Request, res: Response) =>
  handle(res, () => rejectDeleteMovementController());

export const reviewMermaHandler = (req: Request, res: Response) =>
  handle(res, () => {
    const action =
      req.body?.action === "recuperar" ? "recuperar" : req.body?.action === "descartar" ? "descartar" : "";
    if (!action) {
      throw new AppError("Indica si recuperas o descartas la merma");
    }
    return reviewMermaController(Number(req.params.id), action, req.user!.id);
  });

export const listLowStockAlertsHandler = (_req: Request, res: Response) =>
  handle(res, () => listLowStockAlertsController());
