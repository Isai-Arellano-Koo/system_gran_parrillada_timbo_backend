import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload } from "../types/express";

export const signAccessToken = (payload: JwtPayload) => {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
};

export const buildAuthResponse = (user: {
  id: number;
  email: string;
  name: string;
  role: JwtPayload["role"];
}) => {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return {
    accessToken: signAccessToken(payload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};
