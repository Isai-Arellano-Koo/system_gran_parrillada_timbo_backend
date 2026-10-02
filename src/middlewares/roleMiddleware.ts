import { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/enums";

export const requireRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: "No autorizado" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        message: "No tiene permisos para esta acción",
      });
    }

    next();
  };
};
