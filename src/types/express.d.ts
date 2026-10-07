import type { UserRole } from "./enums";

export type JwtPayload = {
  id: number;
  email: string;
  role: UserRole;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
