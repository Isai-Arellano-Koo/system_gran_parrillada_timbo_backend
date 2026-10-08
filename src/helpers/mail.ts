import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

const SUBJECT = "Código para confirmar tu correo — Gran Parrillada Timbó";

const messageText = (code: string) =>
  [
    "Usa este código para confirmar que el correo existe y terminar el registro:",
    "",
    code,
    "",
    "Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.",
  ].join("\n");

const messageHtml = (code: string) => `
  <p>Usa este código para confirmar que el correo existe y terminar el registro en <strong>Gran Parrillada Timbó</strong>:</p>
  <p style="font-size:28px;letter-spacing:0.3em;font-weight:700">${code}</p>
  <p>Caduca en 15 minutos. Si no pediste este código, ignora el mensaje.</p>
`;

export const isMailConfigured = () => Boolean(env.brevo.apiKey && env.brevo.sender);

export const sendVerificationEmail = async (to: string, code: string) => {
  if (env.nodeEnv === "test") return;

  if (!env.brevo.apiKey || !env.brevo.sender) {
    throw new AppError(
      "El envío de correo no está configurado. Define BREVO_API_KEY y BREVO_SENDER."
    );
  }

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
      subject: SUBJECT,
      textContent: messageText(code),
      htmlContent: messageHtml(code),
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
