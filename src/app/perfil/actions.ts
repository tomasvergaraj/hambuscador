"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signOut, auth } from "@/server/auth";
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
  image: z.string().url().optional().or(z.literal("")),
});

export type UpdateProfileState = { error?: string; ok?: boolean };

/**
 * Edita bio + avatar del usuario. La URL del avatar viene del flow de upload
 * directo a R2 (PhotoUploader → requestUploadUrl → PUT). Validamos que el
 * host pertenezca al bucket público — defensive boundary contra el caso de
 * que el form mande otra URL.
 */
export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tienes que iniciar sesión" };

  const parsed = updateProfileSchema.safeParse({
    bio: String(formData.get("bio") ?? ""),
    image: String(formData.get("image") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Normalizamos cadenas vacías a null (borrar el campo).
  const bioTrimmed = parsed.data.bio?.trim();
  const bio: string | null = bioTrimmed ? bioTrimmed : null;
  const imageRaw = parsed.data.image?.trim() ?? "";
  let image: string | null = null;
  if (imageRaw) {
    const expected = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    if (expected && !imageRaw.startsWith(expected)) {
      return { error: "URL de avatar no válida" };
    }
    image = imageRaw;
  }

  try {
    await updateUserProfile(session.user.id, { bio, image });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  redirect("/perfil");
}
