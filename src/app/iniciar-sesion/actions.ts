"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/server/auth";

const credentialsSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type SignInState = {
  error?: string;
};

/**
 * Server Action que valida credenciales y llama a `signIn` de Auth.js.
 * Se usa con `useActionState` desde el form client.
 *
 * Notas:
 * - `signIn` lanza `NEXT_REDIRECT` en éxito (lo re-tiramos para que Next
 *   ejecute la redirección).
 * - Solo capturamos `AuthError` (credenciales malas, usuario no existe).
 */
export async function signInWithCredentials(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Email o contraseña incorrectos" };
      }
      return { error: "No pudimos iniciar sesión, probá de nuevo" };
    }
    throw error;
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}
