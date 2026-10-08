import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import { AppError } from "../src/middlewares/errorHandler";
import { sendVerificationEmail } from "../src/helpers/mail";

const original = {
  nodeEnv: env.nodeEnv,
  apiKey: env.brevo.apiKey,
  sender: env.brevo.sender,
};

afterEach(() => {
  env.nodeEnv = original.nodeEnv;
  env.brevo.apiKey = original.apiKey;
  env.brevo.sender = original.sender;
  vi.unstubAllGlobals();
});

describe("Brevo", () => {
  it("envía el código a la API de Brevo", async () => {
    env.nodeEnv = "development";
    env.brevo.apiKey = "clave-de-prueba";
    env.brevo.sender = "resto@timbo.com";

    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ messageId: "abc" }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("mesero@timbo.com", "123456");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body));

    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(headers["api-key"]).toBe("clave-de-prueba");
    expect(body.sender).toEqual({
      name: "Gran Parrillada Timbó",
      email: "resto@timbo.com",
    });
    expect(body.to).toEqual([{ email: "mesero@timbo.com" }]);
    expect(body.subject).toContain("Gran Parrillada Timbó");
    expect(body.textContent).toContain("123456");
    expect(body.htmlContent).toContain("123456");
  });

  it("no llama a Brevo cuando las pruebas de la API están en curso", async () => {
    env.nodeEnv = "test";
    env.brevo.apiKey = "clave-de-prueba";
    env.brevo.sender = "resto@timbo.com";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("mesero@timbo.com", "123456");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avisa si faltan BREVO_API_KEY o BREVO_SENDER", async () => {
    env.nodeEnv = "development";
    env.brevo.apiKey = "";
    env.brevo.sender = "";

    await expect(sendVerificationEmail("mesero@timbo.com", "123456")).rejects.toMatchObject({
      message: "El envío de correo no está configurado. Define BREVO_API_KEY y BREVO_SENDER.",
    });
  });

  it("responde 502 si Brevo rechaza el envío", async () => {
    env.nodeEnv = "development";
    env.brevo.apiKey = "clave-de-prueba";
    env.brevo.sender = "resto@timbo.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 }))
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await sendVerificationEmail("mesero@timbo.com", "123456");
      throw new Error("El envío debía fallar");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(502);
    }
  });
});
