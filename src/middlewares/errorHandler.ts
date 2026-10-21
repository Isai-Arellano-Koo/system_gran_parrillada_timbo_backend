import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  extra?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    extra?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    this.extra = extra;
  }
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // AppError es un error que nosotros tiramos a propósito
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: true,
      message: err.message,
      ...(err.extra || {}),
    });
  }

  console.error("Error no controlado:", err);
  return res.status(500).json({
    error: true,
    message: "Error interno del servidor",
  });
};
