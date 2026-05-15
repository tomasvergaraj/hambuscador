// ============================================================================
// email-digest — agrega notificaciones in-app no leídas en un único email
// transaccional por usuario, disparado por cron (Vercel) diario/semanal.
// ----------------------------------------------------------------------------
// Filosofía (memoria del proyecto): NO escalar notificaciones linealmente.
// Email digest agrupa el ruido en un solo envío opt-in. El user controla
// frecuencia desde /perfil.
//
// Flow:
//   1. Vercel cron pega a /api/cron/digest?freq=daily|weekly con CRON_SECRET.
//   2. Endpoint llama sendDigestsForFrequency(freq).
//   3. Para cada user opt-in:
//      a) levanta notifs no leídas desde last_digest_sent_at (o últimas N
//         según freq si nunca recibió uno).
//      b) si no hay nada → skip (no spamear con "no tienes nada").
//      c) construye + envía email.
//      d) actualiza last_digest_sent_at = now.
//   4. Devuelve summary (sent, skipped, failed) para los logs del cron.
// ============================================================================

import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";

import { sendEmail } from "@/server/email";
import { getDb, isDbConfigured } from "@/server/db/client";
import {
  notifications,
  users,
  type EmailDigestFrequency,
  type NotificationType,
} from "@/server/db/schema";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";
import type {
  NewFollowerPayload,
  NotificationPayloadMap,
  PromotionApprovedPayload,
  PromotionRejectedPayload,
  ReviewOnOwnedPlacePayload,
} from "./notifications";

// ============================================================================
// Ventanas de tiempo. Damos 23h para daily y 6d 12h para weekly — margen
// defensivo para que un cron que corre con jitter no spamee a un user.
// ============================================================================

const DIGEST_WINDOWS_MS: Record<Exclude<EmailDigestFrequency, "off">, number> = {
  daily: 23 * 60 * 60 * 1000,
  weekly: (6 * 24 + 12) * 60 * 60 * 1000,
};

type DigestEligibleUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  lastDigestSentAt: Date | null;
};

/**
 * Users opt-in a la frecuencia dada, NO baneados, NO baleados por la ventana
 * de cooldown (last_digest_sent_at + window > now → todavía no debe).
 */
async function getUsersDueForDigest(
  frequency: Exclude<EmailDigestFrequency, "off">,
): Promise<DigestEligibleUser[]> {
  const db = getDb();
  const windowMs = DIGEST_WINDOWS_MS[frequency];
  const cutoff = new Date(Date.now() - windowMs);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      username: users.username,
      lastDigestSentAt: users.lastDigestSentAt,
    })
    .from(users)
    .where(
      and(
        eq(users.emailDigestFrequency, frequency),
        isNull(users.bannedAt),
        or(isNull(users.lastDigestSentAt), lt(users.lastDigestSentAt, cutoff)),
      ),
    );
  return rows;
}

/**
 * Notifs no leídas del user desde la última vez que recibió digest. Si nunca
 * recibió uno, caemos a la ventana de la frecuencia (ej. últimos 7 días para
 * weekly). Esto evita inundar al primer envío con notifs de hace meses.
 */
async function getNotifsForDigest(
  userId: string,
  frequency: Exclude<EmailDigestFrequency, "off">,
  lastSent: Date | null,
) {
  const db = getDb();
  const sinceMs = lastSent
    ? lastSent.getTime()
    : Date.now() - DIGEST_WINDOWS_MS[frequency];
  const since = new Date(sinceMs);
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        gt(notifications.createdAt, since),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(20);
  return rows.map((r) => ({
    type: r.type as NotificationType,
    payload: r.payload as NotificationPayloadMap[NotificationType],
    createdAt: r.createdAt,
  }));
}

type DigestNotif = Awaited<ReturnType<typeof getNotifsForDigest>>[number];

// ============================================================================
// Template — HTML + text plain. Brand colors hardcoded (los emails se ven
// sin el CSS-in-JS de tokens, todo inline).
// ============================================================================

function frequencyLabel(freq: Exclude<EmailDigestFrequency, "off">): string {
  return freq === "daily" ? "del día" : "de la semana";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDigestEmail(opts: {
  user: DigestEligibleUser;
  notifs: DigestNotif[];
  frequency: Exclude<EmailDigestFrequency, "off">;
}): { subject: string; html: string; text: string } {
  const { user, notifs, frequency } = opts;
  const greeting = user.name ? `Hola ${user.name.split(" ")[0]}` : "Hola";
  const subject = `tu resumen Hambuscador ${frequencyLabel(frequency)}`;
  const profileUrl = `${SITE_URL}/perfil`;
  const notifsUrl = `${SITE_URL}/perfil/notificaciones`;

  // Agrupar por tipo para que el email sea legible (no un wall lineal).
  const reviewNotifs = notifs.filter((n) => n.type === "review_on_owned_place");
  const followerNotifs = notifs.filter((n) => n.type === "new_follower");
  const promoApproved = notifs.filter((n) => n.type === "promotion_approved");
  const promoRejected = notifs.filter((n) => n.type === "promotion_rejected");

  // ── Text plain ────────────────────────────────────────────────────────────
  const textParts: string[] = [];
  textParts.push(`${greeting},`);
  textParts.push("");
  textParts.push(
    `Tienes ${notifs.length} ${notifs.length === 1 ? "novedad" : "novedades"} en Hambuscador:`,
  );
  textParts.push("");
  if (reviewNotifs.length > 0) {
    textParts.push(`Reseñas en tus locales (${reviewNotifs.length}):`);
    for (const n of reviewNotifs) {
      const p = n.payload as ReviewOnOwnedPlacePayload;
      const stars = "★".repeat(p.rating);
      textParts.push(`  · ${p.reviewerName} reseñó ${p.placeName} (${stars})`);
      if (p.snippet) textParts.push(`    "${p.snippet}"`);
    }
    textParts.push("");
  }
  if (followerNotifs.length > 0) {
    textParts.push(`Nuevos seguidores (${followerNotifs.length}):`);
    for (const n of followerNotifs) {
      const p = n.payload as NewFollowerPayload;
      textParts.push(
        `  · ${p.followerName}${p.followerUsername ? ` (@${p.followerUsername})` : ""}`,
      );
    }
    textParts.push("");
  }
  if (promoApproved.length > 0) {
    textParts.push(`Ofertas aprobadas (${promoApproved.length}):`);
    for (const n of promoApproved) {
      const p = n.payload as PromotionApprovedPayload;
      textParts.push(`  · "${p.promoTitle}" en ${p.placeName}`);
    }
    textParts.push("");
  }
  if (promoRejected.length > 0) {
    textParts.push(`Ofertas rechazadas (${promoRejected.length}):`);
    for (const n of promoRejected) {
      const p = n.payload as PromotionRejectedPayload;
      textParts.push(`  · "${p.promoTitle}" en ${p.placeName}`);
      if (p.reason) textParts.push(`    motivo: ${p.reason}`);
    }
    textParts.push("");
  }
  textParts.push(`Ver todo: ${notifsUrl}`);
  textParts.push("");
  textParts.push(
    `Si quieres cambiar la frecuencia o desactivarlo, entra a ${profileUrl}.`,
  );
  const text = textParts.join("\n");

  // ── HTML ──────────────────────────────────────────────────────────────────
  const renderReviewItem = (n: DigestNotif) => {
    const p = n.payload as ReviewOnOwnedPlacePayload;
    const placeUrl = `${SITE_URL}/${p.comunaSlug}/${p.placeSlug}`;
    const reviewUrl = `${SITE_URL}/r/${p.reviewId}`;
    const stars = "★".repeat(p.rating) + "☆".repeat(5 - p.rating);
    return `
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #E8DDD0;">
          <p style="margin:0 0 4px; font-size:14px; color:#1F1B17;">
            <strong>${escapeHtml(p.reviewerName)}</strong> reseñó
            <a href="${placeUrl}" style="color:#1F1B17; text-decoration:underline;">${escapeHtml(p.placeName)}</a>
          </p>
          <p style="margin:0 0 6px; font-size:13px; color:#E8A02C; letter-spacing:1px;">${stars}</p>
          ${
            p.snippet
              ? `<p style="margin:0 0 6px; font-size:13px; color:#2A2520; font-style:italic;">"${escapeHtml(p.snippet)}"</p>`
              : ""
          }
          <p style="margin:0;">
            <a href="${reviewUrl}" style="font-size:12px; color:#8B7355; text-decoration:none;">leer reseña →</a>
          </p>
        </td>
      </tr>
    `;
  };

  const renderPromoApprovedItem = (n: DigestNotif) => {
    const p = n.payload as PromotionApprovedPayload;
    const placeUrl = `${SITE_URL}/${p.comunaSlug}/${p.placeSlug}`;
    return `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #E8DDD0;">
          <p style="margin:0 0 4px; font-size:14px; color:#1F1B17;">
            <span style="display:inline-block; background:#6B8E4E; color:#F5EFE6; font-size:10px; font-weight:700; letter-spacing:1px; padding:2px 6px; border-radius:4px; margin-right:6px; text-transform:uppercase;">aprobada</span>
            <strong>"${escapeHtml(p.promoTitle)}"</strong>
          </p>
          <p style="margin:0; font-size:12px; color:#8B7355;">
            ya es visible en
            <a href="${placeUrl}" style="color:#8B7355; text-decoration:underline;">${escapeHtml(p.placeName)}</a>
          </p>
        </td>
      </tr>
    `;
  };

  const renderPromoRejectedItem = (n: DigestNotif) => {
    const p = n.payload as PromotionRejectedPayload;
    const ofertasUrl = `${SITE_URL}/mi-local/${p.placeId}/ofertas`;
    return `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #E8DDD0;">
          <p style="margin:0 0 4px; font-size:14px; color:#1F1B17;">
            <span style="display:inline-block; background:#C84B31; color:#F5EFE6; font-size:10px; font-weight:700; letter-spacing:1px; padding:2px 6px; border-radius:4px; margin-right:6px; text-transform:uppercase;">rechazada</span>
            <strong>"${escapeHtml(p.promoTitle)}"</strong>
          </p>
          ${
            p.reason
              ? `<p style="margin:0 0 6px; font-size:13px; color:#2A2520; font-style:italic;">"${escapeHtml(p.reason)}"</p>`
              : ""
          }
          <p style="margin:0;">
            <a href="${ofertasUrl}" style="font-size:12px; color:#8B7355; text-decoration:none;">editar y reenviar →</a>
          </p>
        </td>
      </tr>
    `;
  };

  const renderFollowerItem = (n: DigestNotif) => {
    const p = n.payload as NewFollowerPayload;
    const profileLinkUrl = p.followerUsername
      ? `${SITE_URL}/u/${p.followerUsername}`
      : null;
    return `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #E8DDD0;">
          <p style="margin:0; font-size:14px; color:#1F1B17;">
            ${
              profileLinkUrl
                ? `<a href="${profileLinkUrl}" style="color:#1F1B17; text-decoration:none;"><strong>${escapeHtml(p.followerName)}</strong>${p.followerUsername ? ` <span style="color:#8B7355;">@${escapeHtml(p.followerUsername)}</span>` : ""}</a>`
                : `<strong>${escapeHtml(p.followerName)}</strong>`
            }
            empezó a seguirte
          </p>
        </td>
      </tr>
    `;
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F5EFE6; padding:32px 16px;">
      <div style="max-width:520px; margin:0 auto; background:#FAF6EE; border-radius:14px; padding:28px; color:#1F1B17;">
        <h1 style="margin:0 0 8px; font-size:22px; font-weight:600;">tu resumen ${frequencyLabel(frequency)}</h1>
        <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#2A2520;">
          ${greeting}, tienes <strong>${notifs.length} ${notifs.length === 1 ? "novedad" : "novedades"}</strong> en Hambuscador.
        </p>

        ${
          reviewNotifs.length > 0
            ? `
        <h2 style="margin:0 0 6px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#8B7355; font-weight:600;">
          reseñas en tus locales (${reviewNotifs.length})
        </h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
          <tbody>
            ${reviewNotifs.map(renderReviewItem).join("")}
          </tbody>
        </table>
        `
            : ""
        }

        ${
          followerNotifs.length > 0
            ? `
        <h2 style="margin:0 0 6px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#8B7355; font-weight:600;">
          nuevos seguidores (${followerNotifs.length})
        </h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
          <tbody>
            ${followerNotifs.map(renderFollowerItem).join("")}
          </tbody>
        </table>
        `
            : ""
        }

        ${
          promoApproved.length > 0
            ? `
        <h2 style="margin:0 0 6px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#8B7355; font-weight:600;">
          ofertas aprobadas (${promoApproved.length})
        </h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
          <tbody>
            ${promoApproved.map(renderPromoApprovedItem).join("")}
          </tbody>
        </table>
        `
            : ""
        }

        ${
          promoRejected.length > 0
            ? `
        <h2 style="margin:0 0 6px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#8B7355; font-weight:600;">
          ofertas rechazadas (${promoRejected.length})
        </h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
          <tbody>
            ${promoRejected.map(renderPromoRejectedItem).join("")}
          </tbody>
        </table>
        `
            : ""
        }

        <p style="margin:24px 0 0; text-align:center;">
          <a href="${notifsUrl}" style="display:inline-block; background:#E8A02C; color:#1F1B17; text-decoration:none; font-weight:600; padding:12px 22px; border-radius:10px; font-size:14px;">
            ver todo en Hambuscador
          </a>
        </p>

        <hr style="border:none; border-top:1px solid #E8DDD0; margin:28px 0 16px;" />

        <p style="margin:0; font-size:11px; color:#8B7355; line-height:1.5; text-align:center;">
          recibes este resumen porque activaste digests ${frequency === "daily" ? "diarios" : "semanales"}.<br/>
          <a href="${profileUrl}" style="color:#8B7355;">cambiar frecuencia o desactivar</a>
        </p>
      </div>
    </div>
  `;

  return { subject, html, text };
}

// ============================================================================
// Entry points
// ============================================================================

export type DigestRunSummary = {
  frequency: Exclude<EmailDigestFrequency, "off">;
  candidates: number;
  sent: number;
  skippedNoNotifs: number;
  failed: number;
};

/**
 * Procesa un único usuario. Returns true si se envió email.
 */
async function processUser(
  user: DigestEligibleUser,
  frequency: Exclude<EmailDigestFrequency, "off">,
): Promise<"sent" | "skipped" | "failed"> {
  const notifs = await getNotifsForDigest(user.id, frequency, user.lastDigestSentAt);
  if (notifs.length === 0) return "skipped";

  const { subject, html, text } = buildDigestEmail({ user, notifs, frequency });
  const result = await sendEmail({ to: user.email, subject, html, text });
  if (!result.ok) return "failed";

  // Persistir last_digest_sent_at solo cuando el envío fue OK. Si falla, el
  // próximo run del cron lo intenta de nuevo.
  const db = getDb();
  await db.update(users).set({ lastDigestSentAt: new Date() }).where(eq(users.id, user.id));
  return "sent";
}

/**
 * Loop principal: lo invoca el endpoint del cron. Defensivo: si la DB no
 * está, retorna summary con candidates=0.
 */
export async function sendDigestsForFrequency(
  frequency: Exclude<EmailDigestFrequency, "off">,
): Promise<DigestRunSummary> {
  const summary: DigestRunSummary = {
    frequency,
    candidates: 0,
    sent: 0,
    skippedNoNotifs: 0,
    failed: 0,
  };
  if (!isDbConfigured()) return summary;

  const usersList = await getUsersDueForDigest(frequency);
  summary.candidates = usersList.length;

  for (const u of usersList) {
    try {
      const r = await processUser(u, frequency);
      if (r === "sent") summary.sent += 1;
      else if (r === "skipped") summary.skippedNoNotifs += 1;
      else summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      console.error("[email-digest] user fail", u.id, err);
    }
  }

  return summary;
}

/**
 * Actualiza la preferencia del usuario. Validación del input en el caller
 * (server action) — acá solo escribimos.
 */
export async function setEmailDigestFrequency(
  userId: string,
  frequency: EmailDigestFrequency,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(users)
    .set({ emailDigestFrequency: frequency })
    .where(eq(users.id, userId));
}

export async function getEmailDigestFrequency(
  userId: string,
): Promise<EmailDigestFrequency> {
  if (!isDbConfigured()) return "off";
  const db = getDb();
  const [row] = await db
    .select({ freq: users.emailDigestFrequency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (row?.freq as EmailDigestFrequency) ?? "off";
}
