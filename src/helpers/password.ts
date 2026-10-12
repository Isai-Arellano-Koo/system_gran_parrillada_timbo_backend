import bcrypt from "bcrypt";

const SALT_ROUNDS = 12; // más vueltas = más lento de adivinar, pero tarda más al guardar

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};
