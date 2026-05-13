/**
 * Helper de envío de email — usa Resend si `RESEND_API_KEY` está seteado,
 * sino loguea el contenido al console del server (dev / fallback).
 *
 * Mínimo (fetch directo a la API de Resend, sin SDK) — agregar @resend/sdk
 * solo si necesitamos features avanzadas (webhooks, batch, attachments).
 *
 * Env vars:
 *   RESEND_API_KEY      Bearer token (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL   Remitente verificado, ej. "no-reply@hambuscador.cl"
 *                       Sin esto cae a "onboarding@resend.dev" (sandbox de
 *                       Resend, llega solo al email de la cuenta dueña de
 *                       la API key — útil para test).
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FALLBACK_FROM = "Hambuscador <onboarding@resend.dev>";

export type SendEmailInput = {
  to: string;
  subject: string;
  /** HTML del cuerpo del email. */
  html: string;
  /** Versión texto plano (recomendada por proveedores anti-spam). */
  text?: string;
};

export type SendEmailResult =
  | { ok: true; provider: "resend" | "console"; id?: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? FALLBACK_FROM;

  // Sin API key: log en server console (sirve en dev y como red de seguridad
  // si alguien resetea password antes de configurar Resend).
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY no seteado — el email no se envió. Contenido:",
    );
    console.warn(`  to:      ${input.to}`);
    console.warn(`  subject: ${input.subject}`);
    console.warn(`  text:    ${input.text ?? "(no text variant)"}`);
    return { ok: true, provider: "console" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error", res.status, body);
      return { ok: false, error: `Resend ${res.status}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, provider: "resend", id: json.id };
  } catch (err) {
    console.error("[email] fetch failed", err);
    return { ok: false, error: "fetch failed" };
  }
}

/**
 * Email transaccional para el flow de recuperar password.
 * Branding alineado con el email digest: header con wordmark + tagline,
 * card crema-deep, CTA mostaza, footer disclaimer. Action-oriented voice
 * ("crear nueva contraseña", no "recuperar").
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<SendEmailResult> {
  const subject = "tu link para crear nueva contraseña";
  const text = `hambuscador — la picá hamburguesera de Chile

Recibimos una solicitud para crear una nueva contraseña en tu cuenta.

Abre este link para hacerlo (válido por 1 hora):
${resetUrl}

Si no pediste este reseteo, ignora este email — tu cuenta sigue segura.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F5EFE6; padding:32px 16px;">
      <div style="max-width:480px; margin:0 auto;">

        <div style="text-align:center; padding:0 0 20px;">
          <div style="font-size:24px; font-weight:700; color:#1F1B17; letter-spacing:-0.5px;">hambuscador</div>
          <div style="font-size:11px; color:#8B7355; margin-top:2px;">la picá hamburguesera de Chile</div>
        </div>

        <div style="background:#FAF6EE; border:1px solid #E8DDD0; border-radius:14px; padding:28px; color:#1F1B17;">
          <h1 style="margin:0 0 16px; font-size:20px; font-weight:600;">nueva contraseña</h1>
          <p style="margin:0 0 16px; font-size:14px; line-height:1.5; color:#2A2520;">
            Recibimos una solicitud para crear una nueva contraseña en tu cuenta.
          </p>
          <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#2A2520;">
            Apreta el botón para elegirla. El link vence en 1 hora.
          </p>
          <p style="margin:0 0 24px; text-align:center;">
            <a href="${resetUrl}" style="display:inline-block; background:#E8A02C; color:#1F1B17; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:10px; font-size:14px;">
              crear nueva contraseña
            </a>
          </p>
          <p style="margin:0 0 8px; font-size:12px; color:#6E5F4F;">
            ¿el botón no funciona? Copia y pega este link en tu navegador:
          </p>
          <p style="margin:0 0 4px; font-size:12px; color:#6E5F4F; word-break:break-all;">
            <a href="${resetUrl}" style="color:#6E5F4F;">${resetUrl}</a>
          </p>
        </div>

        <p style="margin:16px 0 0; font-size:11px; color:#8B7355; line-height:1.5; text-align:center;">
          si no pediste este reseteo, ignora este email — tu cuenta sigue segura.
        </p>
      </div>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}

/**
 * Email de bienvenida al registrarse. Fire-and-forget desde el caller:
 * si falla, el registro ya quedó persistido y el user no se entera.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string | null,
): Promise<SendEmailResult> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    "https://hambuscador.cl";
  const firstName = (name ?? "").trim().split(/\s+/)[0] || "qué tal";
  const subject = "bienvenida a Hambuscador";
  const buscarUrl = `${siteUrl}/buscar`;
  const agregarUrl = `${siteUrl}/agregar`;
  const text = `hambuscador — la picá hamburguesera de Chile

Hola ${firstName}, gracias por sumarte a Hambuscador.

Acá podés:
  · Buscar hamburgueserías cerca tuyo → ${buscarUrl}
  · Dejar reseñas y subir fotos
  · Aportar locales nuevos al catálogo → ${agregarUrl}
  · Seguir a otros foodies y armar tu feed

Si tenés una picá favorita que no aparece, sumala — el catálogo crece con cada aporte.

Nos vemos en la próxima hamburguesa.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F5EFE6; padding:32px 16px;">
      <div style="max-width:520px; margin:0 auto;">

        <div style="text-align:center; padding:0 0 20px;">
          <div style="font-size:24px; font-weight:700; color:#1F1B17; letter-spacing:-0.5px;">hambuscador</div>
          <div style="font-size:11px; color:#8B7355; margin-top:2px;">la picá hamburguesera de Chile</div>
        </div>

        <div style="background:#FAF6EE; border:1px solid #E8DDD0; border-radius:14px; padding:28px; color:#1F1B17;">
          <h1 style="margin:0 0 16px; font-size:22px; font-weight:600;">bienvenida, ${escapeForEmail(firstName)}</h1>
          <p style="margin:0 0 14px; font-size:14px; line-height:1.5; color:#2A2520;">
            Gracias por sumarte. Hambuscador es la guía hamburguesera de Chile, hecha por la comunidad — descubrí picás, dejá reseñas y aportá las que conozcas.
          </p>

          <h2 style="margin:20px 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#8B7355; font-weight:600;">
            por dónde empezar
          </h2>
          <ul style="margin:0 0 20px; padding-left:18px; font-size:14px; line-height:1.6; color:#2A2520;">
            <li>Buscá hamburgueserías cerca tuyo en <a href="${buscarUrl}" style="color:#1F1B17; font-weight:600;">/buscar</a>.</li>
            <li>Cuando pruebes una picá, dejá tu reseña con foto.</li>
            <li>Si conocés un local que falta, <a href="${agregarUrl}" style="color:#1F1B17; font-weight:600;">sumalo al catálogo</a> — moderamos antes de publicar.</li>
            <li>Seguí a otros foodies para armar tu feed.</li>
          </ul>

          <p style="margin:0 0 0; text-align:center;">
            <a href="${buscarUrl}" style="display:inline-block; background:#E8A02C; color:#1F1B17; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:10px; font-size:14px;">
              buscar mi primera picá
            </a>
          </p>
        </div>

        <p style="margin:16px 0 0; font-size:11px; color:#8B7355; line-height:1.5; text-align:center;">
          recibís este email porque te registraste en Hambuscador. <a href="${siteUrl}/perfil" style="color:#8B7355;">administrar preferencias</a>
        </p>
      </div>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}

function escapeForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
