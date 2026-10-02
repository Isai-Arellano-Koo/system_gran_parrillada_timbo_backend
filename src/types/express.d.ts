export type JwtPayload = {
  id: number;
  email: string;
  role: "admin" | "mesero" | "cocinero";
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
