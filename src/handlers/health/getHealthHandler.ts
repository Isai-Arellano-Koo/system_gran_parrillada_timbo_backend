import { Request, Response } from "express";
import { getHealthStatus } from "../../controllers/health/health.controller";

export const getHealthHandler = async (_req: Request, res: Response) => {
  try {
    const status = await getHealthStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error("Error en health check:", error);
    res.status(500).json({
      error: true,
      message: "Error al verificar el estado del servidor",
    });
  }
};
