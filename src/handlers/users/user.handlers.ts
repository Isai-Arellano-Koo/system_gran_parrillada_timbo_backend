import { Request, Response } from "express";
import {
  createUserController,
  getUserController,
  listUsersController,
  updateUserController,
} from "../../controllers/users/user.controller";
import { AppError } from "../../middlewares/errorHandler";

const mapUserError = (error: unknown, res: Response) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: true,
      message: error.message,
    });
  }

  console.error("Error de usuarios:", error);
  return res.status(500).json({
    error: true,
    message: "Error interno al gestionar usuarios",
  });
};

export const listUsersHandler = async (_req: Request, res: Response) => {
  try {
    const users = await listUsersController();
    return res.status(200).json(users);
  } catch (error) {
    return mapUserError(error, res);
  }
};

export const getUserHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: true, message: "Usuario inválido" });
    }
    const user = await getUserController(id);
    return res.status(200).json(user);
  } catch (error) {
    return mapUserError(error, res);
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
  try {
    const user = await createUserController(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return mapUserError(error, res);
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: true, message: "No autorizado" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: true, message: "Usuario inválido" });
    }
    const user = await updateUserController(id, req.user.id, req.body);
    return res.status(200).json(user);
  } catch (error) {
    return mapUserError(error, res);
  }
};
