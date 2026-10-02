import { User } from "../../models";
import { comparePassword } from "../../helpers/password";
import { buildAuthResponse } from "../../helpers/authTokens";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";
import { createUserController } from "../users/user.controller";

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  username?: string;
  email: string;
  password: string;
  role: UserRole;
  is_active?: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const loginController = async (data: LoginInput) => {
  const email = normalizeEmail(data.email || "");

  if (!email || !data.password) {
    throw new AppError("Email y contraseña son obligatorios");
  }

  const user = await User.findOne({ where: { email } });
  if (!user || !user.is_active) {
    throw new AppError("Credenciales inválidas", 401);
  }

  const valid = await comparePassword(data.password, user.password_hash);
  if (!valid) {
    throw new AppError("Credenciales inválidas", 401);
  }

  return buildAuthResponse(user);
};

export const registerController = async (data: RegisterInput) => {
  const user = await createUserController(data);
  return buildAuthResponse(user);
};

export const getMeController = async (userId: number) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "name", "username", "email", "role", "is_active"],
  });

  if (!user || !user.is_active) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return user;
};
