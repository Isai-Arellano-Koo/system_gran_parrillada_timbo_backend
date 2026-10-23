import { Request, Response } from "express";
import {
  listIngredientsController,
  createIngredientController,
  updateIngredientController,
  listDishesController,
  getDishController,
  createDishController,
  updateDishController,
  setRecipeController,
  listDishStatusChangesController,
} from "../../controllers/catalog/catalog.controller";
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

export const listIngredientsHandler = (req: Request, res: Response) =>
  handle(res, () => listIngredientsController(req.query.active === "true"));

export const createIngredientHandler = (req: Request, res: Response) =>
  handle(res, () => createIngredientController(req.body), 201);

export const updateIngredientHandler = (req: Request, res: Response) =>
  handle(res, () =>
    updateIngredientController(Number(req.params.id), req.body)
  );

export const listDishesHandler = (req: Request, res: Response) =>
  handle(res, () => {
    // El mesero solo ve lo que está activo en la carta
    const activeOnly =
      req.user?.role !== "admin" || req.query.active === "true";
    return listDishesController(activeOnly);
  });

export const getDishHandler = (req: Request, res: Response) =>
  handle(res, () =>
    getDishController(Number(req.params.id), req.user?.role !== "admin")
  );

export const createDishHandler = (req: Request, res: Response) =>
  handle(res, () => createDishController(req.body), 201);

export const updateDishHandler = (req: Request, res: Response) =>
  handle(res, () => {
    if (!req.user?.id) {
      throw new AppError("No autorizado", 401);
    }
    return updateDishController(Number(req.params.id), req.user.id, req.body);
  });

export const listDishStatusChangesHandler = (req: Request, res: Response) =>
  handle(res, () => listDishStatusChangesController(Number(req.params.id)));

export const setRecipeHandler = (req: Request, res: Response) =>
  handle(res, () => {
    const items = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body)
        ? req.body
        : [];
    return setRecipeController(Number(req.params.dishId), items);
  });
