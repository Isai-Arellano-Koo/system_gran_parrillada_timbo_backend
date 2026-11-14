import { Request, Response } from "express";
import {
  openOrderController,
  joinTablesController,
  splitTableController,
  addOrderDetailController,
  removeOrderDetailController,
  updateOrderDetailController,
  validateStockController,
  confirmOrderController,
  cancelOrderController,
  closeOrderController,
  sendAdditionsController,
  setOrderPaidController,
  listOrdersController,
  listSoldDishesController,
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

export const listOrdersHandler = (req: Request, res: Response) =>
  handle(res, () =>
    listOrdersController(
      typeof req.query.modality === "string" ? req.query.modality : undefined,
      req.user?.role
    )
  );

export const listSoldDishesHandler = (_req: Request, res: Response) =>
  handle(res, () => listSoldDishesController());

export const getOrderHandler = (req: Request, res: Response) =>
  handle(res, () => getOrderController(Number(req.params.orderId)));

export const openOrderHandler = (req: Request, res: Response) =>
  handle(
    res,
    () => openOrderController(req.body || {}, req.user!.id, req.user!.role),
    201
  );

export const joinTablesHandler = (req: Request, res: Response) =>
  handle(res, () =>
    joinTablesController(
      Number(req.body?.from_table_id),
      Number(req.body?.to_table_id),
      req.user!.id,
      req.user!.role
    )
  );

export const splitTableHandler = (req: Request, res: Response) =>
  handle(res, () =>
    splitTableController(Number(req.body?.table_id), req.user!.role)
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

export const updateOrderDetailHandler = (req: Request, res: Response) =>
  handle(res, () =>
    updateOrderDetailController(
      Number(req.params.orderId),
      Number(req.params.detailId),
      req.body
    )
  );

export const validateStockHandler = (req: Request, res: Response) =>
  handle(res, () => validateStockController(Number(req.params.orderId)));

export const confirmOrderHandler = (req: Request, res: Response) =>
  handle(res, () => confirmOrderController(Number(req.params.orderId)));

export const closeOrderHandler = (req: Request, res: Response) =>
  handle(res, () => closeOrderController(Number(req.params.orderId)));

export const sendAdditionsHandler = (req: Request, res: Response) =>
  handle(res, () => sendAdditionsController(Number(req.params.orderId)));

export const setOrderPaidHandler = (req: Request, res: Response) =>
  handle(res, () =>
    setOrderPaidController(Number(req.params.orderId), Boolean(req.body?.paid))
  );

export const cancelOrderHandler = (req: Request, res: Response) =>
  handle(res, () =>
    cancelOrderController(
      Number(req.params.orderId),
      req.body.reason,
      req.user!.id
    )
  );
