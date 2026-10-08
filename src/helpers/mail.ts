import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

export const isMailConfigured = () =>
  Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

export const sendVerificationEmail = async (to: string, code: string) => {
  if (env.nodeEnv === "test") return;

  if (!isMailConfigured()) {
    throw new AppError(
      "El envío de correo no está configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS."
    );
  }

  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  try {
    await transport.sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      subject: "Código para confirmar tu correo — Gran Parrillada Timbó",
      text: [
        "Usa este código para confirmar que el correo existe y terminar el registro:",
        "",
        code,
        "",
        "Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.",
      ].join("\n"),
      html: `
        <p>Usa este código para confirmar que el correo existe y terminar el registro en <strong>Gran Parrillada Timbó</strong>:</p>
        <p style="font-size:28px;letter-spacing:0.3em;font-weight:700">${code}</p>
        <p>Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.</p>
      `,
    });
  } catch (error) {
    console.error("No se pudo enviar el correo de verificación:", error);
    throw new AppError(
      "No se pudo enviar el correo. Revisa la configuración SMTP.",
      502
    );
  }
};
