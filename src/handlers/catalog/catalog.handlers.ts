import { Request, Response } from "express";
import {
  listIngredientsController,
  createIngredientController,
  updateIngredientController,
  listDishesController,
  createDishController,
  updateDishController,
  setRecipeController,
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
  handle(res, () => listDishesController(req.query.active === "true"));

export const createDishHandler = (req: Request, res: Response) =>
  handle(res, () => createDishController(req.body), 201);

export const updateDishHandler = (req: Request, res: Response) =>
  handle(res, () => updateDishController(Number(req.params.id), req.body));

export const setRecipeHandler = (req: Request, res: Response) =>
  handle(res, () =>
    setRecipeController(Number(req.params.dishId), req.body.items || req.body)
  );
