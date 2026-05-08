"use server";

import { revalidatePath } from "next/cache";

import { signOut, auth } from "@/server/auth";
import {
  setUsername,
  UsernameTakenError,
} from "@/server/services/users";

/**
 * Cierra la sesión y vuelve al home. `signOut` con `redirectTo` lanza
 * NEXT_REDIRECT, que Next propaga al cliente.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export type SetUsernameState = { error?: string; ok?: boolean };

/**
 * Setea o cambia el username público del usuario logueado. Habilita
 * `/u/<username>` como perfil público; sin username, el usuario es privado.
 */
export async function setUsernameAction(
  _prev: SetUsernameState,
  formData: FormData,
): Promise<SetUsernameState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tienes que iniciar sesión" };

  const raw = String(formData.get("username") ?? "");
  try {
    await setUsername(session.user.id, raw);
  } catch (err) {
    if (err instanceof UsernameTakenError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }

  revalidatePath("/perfil");
  return { ok: true };
}
