import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

type MailKind = "confirm-email" | "password-reset";

const SUBJECT: Record<MailKind, string> = {
  "confirm-email": "Código para confirmar tu correo — Gran Parrillada Timbó",
  "password-reset": "Código para restablecer tu contraseña — Gran Parrillada Timbó",
};

const messageText = (kind: MailKind, code: string) => {
  const lead =
    kind === "password-reset"
      ? "Usa este código para restablecer tu contraseña:"
      : "Usa este código para confirmar tu correo y activar tu cuenta:";
  return [
    lead,
    "",
    code,
    "",
    "Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.",
  ].join("\n");
};

const messageHtml = (kind: MailKind, code: string) => {
  const lead =
    kind === "password-reset"
      ? "Usa este código para restablecer tu contraseña en <strong>Gran Parrillada Timbó</strong>:"
      : "Usa este código para confirmar tu correo y activar tu cuenta en <strong>Gran Parrillada Timbó</strong>:";
  return `
  <p>${lead}</p>
  <p style="font-size:28px;letter-spacing:0.3em;font-weight:700">${code}</p>
  <p>Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.</p>
`;
};

export const isMailConfigured = () => Boolean(env.brevo.apiKey && env.brevo.sender);

const sendCodeEmail = async (to: string, code: string, kind: MailKind) => {
  if (env.nodeEnv === "test") return; // las pruebas no mandan correo de verdad

  if (!env.brevo.apiKey || !env.brevo.sender) {
    throw new AppError(
      "El envío de correo no está configurado. Define BREVO_API_KEY y BREVO_SENDER."
    );
  }

  // Railway no deja SMTP, así que se manda por HTTPS
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevo.apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Gran Parrillada Timbó", email: env.brevo.sender },
      to: [{ email: to }],
      subject: SUBJECT[kind],
      textContent: messageText(kind, code),
      htmlContent: messageHtml(kind, code),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Brevo rechazó el correo:", response.status, detail);
    throw new AppError(
      "No se pudo enviar el correo. Revisa BREVO_API_KEY y que el remitente esté verificado en Brevo.",
      502
    );
  }
};

export const sendVerificationEmail = async (to: string, code: string) => {
  await sendCodeEmail(to, code, "confirm-email");
};

export const sendPasswordResetEmail = async (to: string, code: string) => {
  await sendCodeEmail(to, code, "password-reset");
};
