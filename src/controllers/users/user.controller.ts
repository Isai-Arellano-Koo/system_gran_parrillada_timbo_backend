import { createHash, randomInt, timingSafeEqual } from "crypto";
import { Op } from "sequelize";
import { EmailVerification, User } from "../../models";
import { hashPassword } from "../../helpers/password";
import { sendVerificationEmail } from "../../helpers/mail";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { USER_ROLES, type UserRole } from "../../types/enums";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_MS = 60 * 1000;

const USERNAME_RE = /^[a-z0-9.]+$/;

const PUBLIC_ATTRIBUTES = [
  "id",
  "name",
  "username",
  "email",
  "role",
  "is_active",
  "created_at",
] as const;

export type PublicUser = {
  id: number;
  name: string;
  username: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: Date;
};

type CreateUserInput = {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  verification_code?: string;
};

type UpdateUserInput = {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  verification_code?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();

const toPublic = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  username: user.username ?? null,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
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

const consumeEmailCode = async (email: string, code: string | undefined) => {
  const clean = (code || "").trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new AppError("Ingresa el código de 6 dígitos que enviamos al correo");
  }

  const row = await EmailVerification.findOne({
    where: {
      email,
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

export const requestEmailCodeController = async (emailRaw?: string) => {
  const email = normalizeEmail(emailRaw || "");
  if (!email.includes("@") || !email.split("@")[1]?.includes(".")) {
    throw new AppError("El correo electrónico no es válido");
  }

  const taken = await User.findOne({ where: { email } });
  if (taken) {
    throw new AppError("Ya existe una cuenta con ese correo");
  }

  const latest = await EmailVerification.findOne({
    where: { email },
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
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MS),
  });

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    await row.destroy();
    throw error;
  }

  return {
    message: "Enviamos un código a ese correo. Caduca en 15 minutos.",
    ...(env.nodeEnv === "test" ? { devCode: code } : {}),
  };
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
  const isActive = data.is_active !== false;

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

  await consumeEmailCode(email, data.verification_code);

  const user = await User.create({
    name,
    username,
    email,
    password_hash: await hashPassword(password),
    role,
    is_active: isActive,
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
    if (email !== user.email) {
      await consumeEmailCode(email, data.verification_code);
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

  user.role = nextRole;
  user.is_active = nextActive;
  await user.save();

  return toPublic(user);
};
