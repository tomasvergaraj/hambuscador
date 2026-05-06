"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { UserAlreadyExistsError, createUser } from "@/server/services/users";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Tu nombre tiene que tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type RegisterState = {
  error?: string;
};

/**
 * Crea la cuenta y autologuea. Devuelve `{ error }` o redirige (en éxito,
 * `signIn` lanza NEXT_REDIRECT que se propaga).
 */
export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  if (!isDbConfigured()) {
    return {
      error: "Modo demo: registro deshabilitado. Configurá DATABASE_URL para crear cuentas.",
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await createUser(parsed.data);
  } catch (error) {
    if (error instanceof UserAlreadyExistsError) {
      return { error: "Ya existe una cuenta con ese email. Probá iniciar sesión." };
    }
    throw error;
  }

  // Autologueo con las mismas credenciales
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Cuenta creada pero login automático falló — caso raro, mandamos al login
      return {
        error: "Cuenta creada, pero el login automático falló. Iniciá sesión manualmente.",
      };
    }
    throw error;
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}
