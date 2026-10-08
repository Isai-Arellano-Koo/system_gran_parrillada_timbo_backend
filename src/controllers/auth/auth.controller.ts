import { User } from "../../models";
import { comparePassword } from "../../helpers/password";
import {
  buildAuthResponse,
  signConfirmToken,
  verifyConfirmToken,
} from "../../helpers/authTokens";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";
import {
  confirmAccountController,
  createUserController,
  issueEmailCode,
} from "../users/user.controller";

type LoginInput = {
  email?: string;
  username?: string;
  password?: string;
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
  const username = (data.username || "").trim().toLowerCase();
  const email = normalizeEmail(data.email || "");
  const identifier = username || email;

  if (!identifier || !data.password) {
    throw new AppError("El usuario o correo y la contraseña son obligatorios");
  }

  const user = identifier.includes("@")
    ? await User.findOne({ where: { email: identifier } })
    : await User.findOne({ where: { username: identifier } });
  if (!user) {
    throw new AppError("Credenciales inválidas", 401);
  }

  const valid = await comparePassword(data.password, user.password_hash);
  if (!valid) {
    throw new AppError("Credenciales inválidas", 401);
  }

  if (!user.email_verified) {
    let message =
      "Confirma tu correo para activar la cuenta. Te enviamos un código de 6 dígitos.";
    let devCode: string | undefined;
    try {
      const sent = await issueEmailCode(user.email);
      message = sent.message;
      devCode = sent.devCode;
    } catch (error) {
      if (
        !(error instanceof AppError) ||
        !error.message.startsWith("Espera un minuto")
      ) {
        throw error;
      }
      message =
        "Ya enviamos un código a tu correo. Revisa la bandeja. Caduca en 15 minutos.";
    }

    return {
      needsEmailConfirmation: true as const,
      confirmationToken: signConfirmToken(user.id),
      email: user.email,
      message,
      ...(devCode ? { devCode } : {}),
    };
  }

  if (!user.is_active) {
    throw new AppError("Credenciales inválidas", 401);
  }

  return buildAuthResponse(user);
};

export const confirmEmailController = async (token: string, code: string) => {
  let userId: number;
  try {
    userId = verifyConfirmToken(token).id;
  } catch {
    throw new AppError(
      "La confirmación caducó. Vuelve a iniciar sesión para recibir otro código.",
      401
    );
  }

  const user = await confirmAccountController(userId, code);
  return buildAuthResponse(user);
};

export const resendConfirmEmailController = async (token: string) => {
  let userId: number;
  try {
    userId = verifyConfirmToken(token).id;
  } catch {
    throw new AppError(
      "La confirmación caducó. Vuelve a iniciar sesión para recibir otro código.",
      401
    );
  }

  const user = await User.findByPk(userId);
  if (!user || user.email_verified) {
    throw new AppError("Esta cuenta ya confirmó su correo");
  }

  return issueEmailCode(user.email);
};

export const registerController = async (data: RegisterInput) => {
  return createUserController(data);
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
