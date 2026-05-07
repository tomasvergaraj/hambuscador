"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { addFavorite, isFavorite, removeFavorite } from "@/server/services/favorites";

const schema = z.object({
  placeId: z.string().uuid("placeId inválido"),
  comuna: z.string().min(1),
  slug: z.string().min(1),
});

/**
 * Toggle del favorito del usuario sobre un local. Si no hay sesión redirige
 * a `/iniciar-sesion`. Decide add/remove según el estado actual — el cliente
 * solo manda placeId, no necesita saber el estado.
 */
export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const parsed = schema.safeParse({
    placeId: formData.get("placeId"),
    comuna: formData.get("comuna"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  const userId = session.user.id;
  const already = await isFavorite(userId, parsed.data.placeId);

  if (already) {
    await removeFavorite(userId, parsed.data.placeId);
  } else {
    await addFavorite(userId, parsed.data.placeId);
  }

  revalidateTag("places");
  revalidatePath(`/${parsed.data.comuna}/${parsed.data.slug}`);
  revalidatePath("/perfil");
}
