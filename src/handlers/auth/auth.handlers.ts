import { Request, Response } from "express";
import {
  loginController,
  registerController,
  getMeController,
} from "../../controllers/auth/auth.controller";
import { AppError } from "../../middlewares/errorHandler";

const mapAuthError = (error: unknown, res: Response) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: true,
      message: error.message,
    });
  }

  console.error("Error de auth:", error);
  return res.status(500).json({
    error: true,
    message: "Error interno de autenticación",
  });
};

export const loginHandler = async (req: Request, res: Response) => {
  try {
    const result = await loginController(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return mapAuthError(error, res);
  }
};

export const registerHandler = async (req: Request, res: Response) => {
  try {
    const result = await registerController(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return mapAuthError(error, res);
  }
};

export const getMeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: true, message: "No autorizado" });
    }

    const user = await getMeController(req.user.id);
    return res.status(200).json(user);
  } catch (error) {
    return mapAuthError(error, res);
  }
};

export const logoutHandler = async (_req: Request, res: Response) => {
  return res.status(200).json({
    message: "Sesión cerrada. Elimine el token en el cliente.",
  });
};
