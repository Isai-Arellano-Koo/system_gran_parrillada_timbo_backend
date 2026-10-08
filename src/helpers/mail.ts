import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

const resolveIpv4 = async (hostname: string) => {
  if (net.isIP(hostname)) return hostname;
  const resolved = await dns.lookup(hostname, { family: 4 });
  if (!resolved.address) {
    throw new AppError("No se pudo resolver el servidor SMTP.", 502);
  }
  return resolved.address;
};

export const isMailConfigured = () =>
  Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

export const sendVerificationEmail = async (to: string, code: string) => {
  if (env.nodeEnv === "test") return;

  if (!isMailConfigured()) {
    throw new AppError(
      "El envío de correo no está configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS."
    );
  }

  let host = env.smtp.host;
  try {
    host = await resolveIpv4(env.smtp.host);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("No se pudo resolver el servidor SMTP:", error);
    throw new AppError("No se pudo resolver el servidor SMTP.", 502);
  }

  const transport = nodemailer.createTransport({
    host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
    tls: {
      servername: env.smtp.host,
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
