import { Request, Response } from "express";
import {
  openOrderController,
  addOrderDetailController,
  removeOrderDetailController,
  validateStockController,
  confirmOrderController,
  cancelOrderController,
  listOrdersController,
  getOrderController,
  listTablesController,
  seedTablesController,
} from "../../controllers/orders/order.controller";
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

export const listTablesHandler = (_req: Request, res: Response) =>
  handle(res, () => listTablesController());

export const seedTablesHandler = (_req: Request, res: Response) =>
  handle(res, () => seedTablesController(30), 201);

export const listOrdersHandler = (_req: Request, res: Response) =>
  handle(res, () => listOrdersController());

export const getOrderHandler = (req: Request, res: Response) =>
  handle(res, () => getOrderController(Number(req.params.orderId)));

export const openOrderHandler = (req: Request, res: Response) =>
  handle(
    res,
    () => openOrderController(Number(req.body.table_id), req.user!.id),
    201
  );

export const addOrderDetailHandler = (req: Request, res: Response) =>
  handle(
    res,
    () => addOrderDetailController(Number(req.params.orderId), req.body),
    201
  );

export const removeOrderDetailHandler = (req: Request, res: Response) =>
  handle(res, () =>
    removeOrderDetailController(
      Number(req.params.orderId),
      Number(req.params.detailId)
    )
  );

export const validateStockHandler = (req: Request, res: Response) =>
  handle(res, () => validateStockController(Number(req.params.orderId)));

export const confirmOrderHandler = (req: Request, res: Response) =>
  handle(res, () => confirmOrderController(Number(req.params.orderId)));

export const cancelOrderHandler = (req: Request, res: Response) =>
  handle(res, () =>
    cancelOrderController(
      Number(req.params.orderId),
      req.body.reason,
      req.user!.id
    )
  );
