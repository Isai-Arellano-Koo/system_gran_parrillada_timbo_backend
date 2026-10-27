import { createHash, randomInt, timingSafeEqual } from "crypto";
import { Op } from "sequelize";
import { EmailVerification, User, UserStatusChange } from "../../models";
import { hashPassword } from "../../helpers/password";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../helpers/mail";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { USER_ROLES, type UserRole } from "../../types/enums";

const CODE_TTL_MS = 15 * 60 * 1000; // el código dura 15 minutos
const RESEND_MS = 60 * 1000; // no se puede pedir otro hasta pasar un minuto

const USERNAME_RE = /^[a-z0-9.]+$/;

const PUBLIC_ATTRIBUTES = [
  "id",
  "name",
  "username",
  "email",
  "role",
  "is_active",
  "email_verified",
  "created_at",
] as const;

export type PublicUser = {
  id: number;
  name: string;
  username: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at?: Date;
};

type CreateUserInput = {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
};

type UpdateUserInput = {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  status_reason?: string;
};

export type EmailCodePurpose = "confirm-email" | "password-reset";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();

const toPublic = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  username: user.username ?? null,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
  email_verified: user.email_verified,
  created_at: user.created_at,
});

const assertUsername = (username: string) => {
  if (!username || !USERNAME_RE.test(username)) {
    throw new AppError(
      "El nombre de usuario solo puede tener letras, números y puntos, sin espacios"
    );
  }
};

const assertRole = (role: UserRole | undefined): UserRole => {
  if (!role || !USER_ROLES.includes(role)) {
    throw new AppError("Rol inválido");
  }
  return role;
};

const hashCode = (code: string) =>
  createHash("sha256").update(code).digest("hex");

const sameHash = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

// Marca el código como usado. Solo sirve una vez
const consumeEmailCode = async (
  email: string,
  code: string | undefined,
  purpose: EmailCodePurpose
) => {
  const clean = (code || "").trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new AppError("Ingresa el código de 6 dígitos que enviamos al correo");
  }

  const row = await EmailVerification.findOne({
    where: {
      email,
      purpose,
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
    order: [["created_at", "DESC"]],
  });

  if (!row || !sameHash(row.code_hash, hashCode(clean))) {
    throw new AppError("El código es incorrecto o ya caducó");
  }

  row.used_at = new Date();
  await row.save();
};

export const issueEmailCode = async (
  emailRaw: string,
  purpose: EmailCodePurpose = "confirm-email"
) => {
  const email = normalizeEmail(emailRaw);
  if (!email.includes("@") || !email.split("@")[1]?.includes(".")) {
    throw new AppError("El correo electrónico no es válido");
  }

  const latest = await EmailVerification.findOne({
    where: { email, purpose },
    order: [["created_at", "DESC"]],
  });
  if (
    latest?.created_at &&
    Date.now() - new Date(latest.created_at).getTime() < RESEND_MS
  ) {
    throw new AppError("Espera un minuto antes de pedir otro código");
  }

  const code = String(randomInt(100000, 1000000));
  const row = await EmailVerification.create({
    email,
    purpose,
    code_hash: hashCode(code), // guardamos el hash, no el número
    expires_at: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    if (purpose === "password-reset") {
      await sendPasswordResetEmail(email, code);
    } else {
      await sendVerificationEmail(email, code);
    }
  } catch (error) {
    await row.destroy();
    throw error;
  }

  return {
    message: "Enviamos un código a ese correo. Caduca en 15 minutos.",
    ...(env.nodeEnv === "test" ? { devCode: code } : {}), // en pruebas sí devolvemos el código
  };
};

export const confirmAccountController = async (userId: number, code: string) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  if (user.email_verified) {
    if (!user.is_active) {
      throw new AppError(
        "Tu cuenta está suspendida. Pide a un administrador que la reactive.",
        403
      );
    }
    return user;
  }

  await consumeEmailCode(user.email, code, "confirm-email");
  user.email_verified = true;
  user.is_active = true; // recién acá puede entrar al sistema
  await user.save();
  return user;
};

export const listUsersController = async () => {
  return User.findAll({
    attributes: [...PUBLIC_ATTRIBUTES],
    order: [["name", "ASC"]],
  });
};

export const getUserController = async (id: number) => {
  const user = await User.findByPk(id, {
    attributes: [...PUBLIC_ATTRIBUTES],
  });
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return user;
};

export const createUserController = async (data: CreateUserInput) => {
  const name = data.name?.trim() || "";
  const email = normalizeEmail(data.email || "");
  const username = normalizeUsername(data.username || "");
  const password = data.password || "";
  const role = assertRole(data.role);

  if (!name) {
    throw new AppError("El nombre es obligatorio");
  }
  assertUsername(username);
  if (!email || !email.includes("@")) {
    throw new AppError("El correo electrónico no es válido");
  }
  if (password.length < 8) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres");
  }

  const emailTaken = await User.findOne({ where: { email } });
  if (emailTaken) {
    throw new AppError("Ya existe una cuenta con ese correo");
  }

  const usernameTaken = await User.findOne({ where: { username } });
  if (usernameTaken) {
    throw new AppError("Ese nombre de usuario ya está en uso");
  }

  const user = await User.create({
    name,
    username,
    email,
    password_hash: await hashPassword(password),
    role,
    is_active: false, // queda pendiente hasta confirmar el correo
    email_verified: false,
  });

  return toPublic(user);
};

export const updateUserController = async (
  id: number,
  actorId: number,
  data: UpdateUserInput
) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const nextRole = data.role === undefined ? user.role : assertRole(data.role);
  const nextActive =
    data.is_active === undefined ? user.is_active : Boolean(data.is_active);

  if (nextActive && !user.email_verified) {
    throw new AppError(
      "La cuenta se activa cuando la persona confirma su correo en el primer ingreso"
    );
  }

  if (user.id === actorId && nextRole !== user.role) {
    throw new AppError("No puedes cambiar tu propio rol");
  }
  if (user.id === actorId && nextActive === false) {
    throw new AppError("No puedes suspender tu propia cuenta");
  }

  const removesAdmin =
    user.role === "admin" && user.is_active && (nextRole !== "admin" || !nextActive);

  if (removesAdmin) {
    const otherAdmins = await User.count({
      where: {
        role: "admin",
        is_active: true,
        id: { [Op.ne]: user.id },
      },
    });
    if (otherAdmins === 0) {
      // No dejamos el local sin ningún admin
      throw new AppError("Debe quedar al menos un administrador activo");
    }
  }

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) {
      throw new AppError("El nombre es obligatorio");
    }
    user.name = name;
  }

  if (data.email !== undefined) {
    const email = normalizeEmail(data.email);
    if (!email.includes("@")) {
      throw new AppError("El correo electrónico no es válido");
    }
    const taken = await User.findOne({
      where: { email, id: { [Op.ne]: user.id } },
    });
    if (taken) {
      throw new AppError("Ya existe una cuenta con ese correo");
    }
    user.email = email;
  }

  if (data.username !== undefined) {
    const username = normalizeUsername(data.username);
    assertUsername(username);
    const taken = await User.findOne({
      where: { username, id: { [Op.ne]: user.id } },
    });
    if (taken) {
      throw new AppError("Ese nombre de usuario ya está en uso");
    }
    user.username = username;
  }

  if (data.password) {
    if (data.password.length < 8) {
      throw new AppError("La contraseña debe tener al menos 8 caracteres");
    }
    user.password_hash = await hashPassword(data.password);
  }

  const statusChanged = nextActive !== user.is_active;
  let statusReason = "";
  if (statusChanged) {
    statusReason = (data.status_reason || "").trim();
    if (statusReason.length < 3) {
      throw new AppError("Indica el motivo del cambio de estado");
    }
  }

  const previousActive = user.is_active;
  user.role = nextRole;
  user.is_active = nextActive;
  await user.save();

  if (statusChanged) {
    // El cambio queda en una tabla aparte, no solo en la pantalla
    await UserStatusChange.create({
      user_id: user.id,
      previous_is_active: previousActive,
      next_is_active: nextActive,
      reason: statusReason,
      changed_by: actorId,
    });
  }

  return toPublic(user);
};

const statusChangeIncludes = [
  {
    model: User,
    as: "user" as const,
    attributes: ["id", "name", "username", "email", "role"],
  },
  {
    model: User,
    as: "changed_by_user" as const,
    attributes: ["id", "name", "username", "email"],
  },
];

export const listUserStatusChangesController = async (userId: number) => {
  const user = await User.findByPk(userId, { attributes: ["id"] });
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  return UserStatusChange.findAll({
    where: { user_id: userId },
    include: statusChangeIncludes,
    order: [["created_at", "DESC"]],
  });
};

export const listAllUserStatusChangesController = async () => {
  return UserStatusChange.findAll({
    include: statusChangeIncludes,
    order: [["created_at", "DESC"]],
  });
};

export const consumePasswordResetCode = async (email: string, code: string) => {
  await consumeEmailCode(email, code, "password-reset");
};
