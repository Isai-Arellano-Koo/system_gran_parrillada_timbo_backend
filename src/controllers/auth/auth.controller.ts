import { User } from "../../models";
import { comparePassword, hashPassword } from "../../helpers/password";
import {
  buildAuthResponse,
  signConfirmToken,
  verifyConfirmToken,
} from "../../helpers/authTokens";
import {
  assertNotLocked,
  clearLoginLock,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "../../helpers/loginLock";
import { AppError } from "../../middlewares/errorHandler";
import type { UserRole } from "../../types/enums";
import {
  confirmAccountController,
  consumePasswordResetCode,
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

const findUserByIdentifier = async (identifier: string) => {
  return identifier.includes("@")
    ? User.findOne({ where: { email: identifier } })
    : User.findOne({ where: { username: identifier } });
};

const RESET_MESSAGE =
  "Si la cuenta existe, enviamos un código de 6 dígitos. Caduca en 15 minutos.";

export const loginController = async (data: LoginInput) => {
  const username = (data.username || "").trim().toLowerCase();
  const email = normalizeEmail(data.email || "");
  const identifier = username || email;

  if (!identifier || !data.password) {
    throw new AppError("El usuario o correo y la contraseña son obligatorios");
  }

  // Puede entrar con correo o con nombre de usuario
  const user = await findUserByIdentifier(identifier);
  await assertNotLocked(user?.id ?? null, identifier);

  if (!user) {
    await recordFailedLogin(null, identifier);
  }

  const valid = await comparePassword(data.password, user.password_hash);
  if (!valid) {
    await recordFailedLogin(user.id, identifier);
  }

  await clearLoginLock(user.id, identifier);

  // Si todavía no confirmó el correo, no le damos sesión
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

  // Cuenta suspendida: mismo mensaje que si la clave estuviera mal
  if (!user.is_active) {
    await recordFailedLogin(user.id, identifier);
  }

  await recordSuccessfulLogin(user.id, identifier);
  return buildAuthResponse(user);
};

export const requestPasswordResetController = async (data: LoginInput) => {
  const identifier = ((data.username || data.email || "") as string)
    .trim()
    .toLowerCase();
  if (!identifier) {
    throw new AppError("Indica el usuario o el correo de la cuenta");
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return { message: RESET_MESSAGE };
  }

  const sent = await issueEmailCode(user.email, "password-reset");
  return {
    message: RESET_MESSAGE,
    emailHint: user.email,
    ...(sent.devCode ? { devCode: sent.devCode } : {}),
  };
};

export const confirmPasswordResetController = async (data: {
  email?: string;
  username?: string;
  code?: string;
  password?: string;
}) => {
  const identifier = ((data.username || data.email || "") as string)
    .trim()
    .toLowerCase();
  const password = data.password || "";

  if (!identifier) {
    throw new AppError("Indica el usuario o el correo de la cuenta");
  }
  if (password.length < 8) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres");
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    throw new AppError("El código es incorrecto o ya caducó");
  }

  await consumePasswordResetCode(user.email, data.code || "");
  user.password_hash = await hashPassword(password);
  await user.save();
  await clearLoginLock(user.id, identifier);
  await clearLoginLock(user.id, user.email);
  if (user.username) {
    await clearLoginLock(user.id, user.username);
  }

  return {
    message: "Contraseña actualizada. Ya puedes iniciar sesión.",
  };
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
