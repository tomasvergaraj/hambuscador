"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { deleteReviewAsAdmin } from "@/server/services/reviews";

const schema = z.object({
  reviewId: z.string().uuid(),
});

/**
 * Borra una reseña como admin. Doble guard: layout `/admin/*` ya
 * redirige sin sesión / sin rol admin, pero igual chequeamos acá
 * porque las server actions se exponen como endpoints HTTP.
 */
export async function deleteReviewAdminAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }

  const parsed = schema.safeParse({ reviewId: formData.get("reviewId") });
  if (!parsed.success) return;

  await deleteReviewAsAdmin(parsed.data.reviewId);

  revalidateTag("reviews");
  revalidateTag("places");
  revalidatePath("/admin/resenas");
}
