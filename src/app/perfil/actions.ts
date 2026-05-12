"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signOut, auth } from "@/server/auth";
import {
  removePushSubscription,
  savePushSubscription,
  type PushSubscriptionInput,
} from "@/server/services/push";
import {
  setUsername,
  updateUserProfile,
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

const BIO_MAX = 280;

const updateProfileSchema = z.object({
  bio: z
    .string()
    .max(BIO_MAX, `La bio no puede tener más de ${BIO_MAX} caracteres`)
    .optional(),
  imageMode: z.enum(["keep", "new", "remove"]).default("keep"),
  image: z.string().url().optional().or(z.literal("")),
});

export type UpdateProfileState = { error?: string; ok?: boolean };

/**
 * Edita bio + avatar del usuario.
 *
 * `imageMode` discrimina el intent del client:
 *   - keep: no tocar image (default, ej. user solo editó bio)
 *   - new: subió foto al R2 → guardar la URL del campo `image`
 *   - remove: pidió quitar foto → setear a null (cae a iniciales)
 *
 * La URL del avatar (en modo `new`) debe ser del bucket R2 público — boundary
 * defensivo contra el caso de que el form mande otra URL.
 */
export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tienes que iniciar sesión" };

  const parsed = updateProfileSchema.safeParse({
    bio: String(formData.get("bio") ?? ""),
    imageMode: String(formData.get("imageMode") ?? "keep"),
    image: String(formData.get("image") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const bioTrimmed = parsed.data.bio?.trim();
  const bio: string | null = bioTrimmed ? bioTrimmed : null;

  // Image solo se incluye en el patch si el user lo cambió. updateUserProfile
  // ignora keys ausentes en el input.
  const patch: { bio: string | null; image?: string | null } = { bio };
  if (parsed.data.imageMode === "remove") {
    patch.image = null;
  } else if (parsed.data.imageMode === "new") {
    const imageRaw = parsed.data.image?.trim() ?? "";
    if (!imageRaw) {
      return { error: "Falta la URL del avatar" };
    }
    const expected = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    if (expected && !imageRaw.startsWith(expected)) {
      return { error: "URL de avatar no válida" };
    }
    patch.image = imageRaw;
  }

  try {
    await updateUserProfile(session.user.id, patch);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  redirect("/perfil");
}

/**
 * Persiste una suscripción Web Push del browser. Llamada desde el cliente
 * después de `pushManager.subscribe()`. Upsert por endpoint — re-subscribe
 * del mismo browser actualiza en vez de duplicar.
 */
export async function subscribePushAction(input: {
  sub: PushSubscriptionInput;
  userAgent: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "no autorizado" };
  try {
    await savePushSubscription({
      userId: session.user.id,
      sub: input.sub,
      userAgent: input.userAgent.slice(0, 500),
    });
    revalidatePath("/perfil");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "error desconocido" };
  }
}

/**
 * Borra una suscripción por endpoint. Llamada cuando el user desactiva el
 * opt-in desde /perfil — el cliente también hace `pushSubscription.unsubscribe()`
 * para limpiar del browser.
 */
export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await removePushSubscription(endpoint);
  revalidatePath("/perfil");
}
