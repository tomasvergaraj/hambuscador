"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/server/auth";
import { sendPasswordResetEmail } from "@/server/email";
import {
  InvalidResetTokenError,
  consumeResetTokenAndSetPassword,
  createPasswordResetToken,
} from "@/server/services/password-reset";

// ============================================================================
// Server actions del flow de recuperar contraseña
// ----------------------------------------------------------------------------
// Request: /recuperar      -> requestPasswordReset
// Consume: /recuperar/<t>  -> resetPassword
//
// El response del request es siempre genérico para evitar email enumeration.
// ============================================================================

const requestSchema = z.object({
  email: z.string().email("Email inválido"),
});

export type RequestState = {
  /** Mostramos esto al usuario tanto si el email existe como si no. */
  ok?: boolean;
  error?: string;
};

const GENERIC_OK_MSG =
  "Si esa cuenta existe, te mandamos un link para crear una nueva contraseña. Revisa tu correo.";

export async function requestPasswordReset(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Resolvemos el SITE_URL para armar el link absoluto.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";

  try {
    const created = await createPasswordResetToken(parsed.data.email);

    if (created) {
      const url = `${baseUrl.replace(/\/$/, "")}/recuperar/${created.token}`;
      // Fire-and-forget: si Resend falla, igual respondemos OK al user
      // (el log queda en server). No queremos bloquear al usuario por
      // un problema del proveedor de email.
      void sendPasswordResetEmail(created.user.email, url).catch((err) => {
        console.error("[recuperar] email send failed", err);
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("[recuperar] requestPasswordReset failed", err);
    // Mismo response genérico — no queremos exponer detalles del error
    return { ok: true };
  }
}

export const RECOVERY_OK_MESSAGE = GENERIC_OK_MSG;

// ----------------------------------------------------------------------------

const resetSchema = z
  .object({
    token: z.string().min(16, "Link inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm: z.string().min(8, "Confirma la contraseña"),
    email: z.string().email(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export type ResetState = {
  error?: string;
};

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await consumeResetTokenAndSetPassword(parsed.data.token, parsed.data.password);
  } catch (err) {
    if (err instanceof InvalidResetTokenError) {
      return { error: err.message };
    }
    console.error("[recuperar] resetPassword failed", err);
    return { error: "No pudimos resetear tu contraseña, intenta de nuevo" };
  }

  // Auto-login con las nuevas credenciales
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error: "Tu contraseña fue actualizada, pero el login automático falló. Inicia sesión manualmente.",
      };
    }
    throw err;
  }
}
