import { LoginAttempt, LoginLock } from "../models";
import { AppError } from "../middlewares/errorHandler";

export const LOGIN_FAIL_LIMIT = 5;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export const lockKeyFor = (userId: number | null, identifier: string) =>
  userId ? `user:${userId}` : `id:${identifier}`;

const asTime = (value: Date | string | null | undefined) =>
  value ? new Date(value).getTime() : 0;

const lockPayload = (until: Date) => ({
  locked: true,
  lockedUntil: until.toISOString(),
  resetAvailable: true,
});

export const assertNotLocked = async (
  userId: number | null,
  identifier: string
) => {
  const lock_key = lockKeyFor(userId, identifier);
  const row = await LoginLock.findOne({ where: { lock_key } });
  if (!row?.locked_until) return row;

  if (asTime(row.locked_until) > Date.now()) {
    await LoginAttempt.create({
      identifier,
      user_id: userId,
      success: false,
      blocked: true,
    });
    throw new AppError(
      "Demasiados intentos fallidos. Espera 15 minutos o restablece la contraseña.",
      429,
      lockPayload(new Date(row.locked_until))
    );
  }

  return row;
};

export const recordFailedLogin = async (
  userId: number | null,
  identifier: string
): Promise<never> => {
  const lock_key = lockKeyFor(userId, identifier);
  const row =
    (await LoginLock.findOne({ where: { lock_key } })) ||
    (await LoginLock.create({
      lock_key,
      identifier,
      user_id: userId,
      fail_count: 0,
    }));

  if (asTime(row.updated_at) && Date.now() - asTime(row.updated_at) >= LOGIN_FAIL_WINDOW_MS) {
    row.fail_count = 0;
    row.locked_until = null;
  }

  row.identifier = identifier;
  row.user_id = userId;
  row.fail_count += 1;

  if (row.fail_count >= LOGIN_FAIL_LIMIT) {
    row.locked_until = new Date(Date.now() + LOGIN_LOCK_MS);
  }

  await row.save();
  await LoginAttempt.create({
    identifier,
    user_id: userId,
    success: false,
    blocked: false,
  });

  if (row.locked_until && asTime(row.locked_until) > Date.now()) {
    throw new AppError(
      "Demasiados intentos fallidos. Espera 15 minutos o restablece la contraseña.",
      429,
      lockPayload(new Date(row.locked_until))
    );
  }

  throw new AppError("Credenciales inválidas", 401);
};

export const recordSuccessfulLogin = async (
  userId: number,
  identifier: string
) => {
  await LoginAttempt.create({
    identifier,
    user_id: userId,
    success: true,
    blocked: false,
  });
  await clearLoginLock(userId, identifier);
};

export const clearLoginLock = async (
  userId: number | null,
  identifier: string
) => {
  const lock_key = lockKeyFor(userId, identifier);
  const row = await LoginLock.findOne({ where: { lock_key } });
  if (!row) return;
  row.fail_count = 0;
  row.locked_until = null;
  await row.save();
};
