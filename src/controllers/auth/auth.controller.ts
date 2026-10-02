import { User } from "../../models";
import { comparePassword, hashPassword } from "../../helpers/password";
import { buildAuthResponse } from "../../helpers/authTokens";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";
import { USER_ROLES } from "../../types/enums";

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
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
  const email = normalizeEmail(data.email || "");
  const name = data.name?.trim();

  if (!name) {
    throw new AppError("El nombre es obligatorio");
  }
  if (!email) {
    throw new AppError("El email es obligatorio");
  }
  if (!data.password || data.password.length < 6) {
    throw new AppError("La contraseña debe tener al menos 6 caracteres");
  }
  if (!USER_ROLES.includes(data.role)) {
    throw new AppError("Rol inválido");
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Ya existe una cuenta con ese email");
  }

  const user = await User.create({
    name,
    email,
    password_hash: await hashPassword(data.password),
    role: data.role,
  });

  return buildAuthResponse(user);
};

export const getMeController = async (userId: number) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "name", "email", "role", "is_active"],
  });

  if (!user || !user.is_active) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return user;
};
