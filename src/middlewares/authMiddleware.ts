import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../helpers/authTokens";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "No autorizado, falta token" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: true, message: "Token inválido" });
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res
      .status(401)
      .json({ error: true, message: "Token inválido o expirado" });
  }
};
