"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { approvePlace, rejectPlace } from "@/server/services/places";

const idSchema = z.object({ placeId: z.string().uuid() });

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("no autorizado");
  }
}

/**
 * Aprueba un place pending → public. Después invalida caches del home,
 * búsqueda y el detalle (que recién ahora existe).
 */
export async function approveAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) throw new Error("modo demo: no se puede moderar");
  await assertAdmin();

  const parsed = idSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) throw new Error("placeId inválido");

  await approvePlace(parsed.data.placeId);

  revalidateTag("places");
  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath("/admin/moderacion");
}

/**
 * Marca el place como rejected (queda para auditoría, no se borra).
 */
export async function rejectAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) throw new Error("modo demo: no se puede moderar");
  await assertAdmin();

  const parsed = idSchema.safeParse({ placeId: formData.get("placeId") });
  if (!parsed.success) throw new Error("placeId inválido");

  await rejectPlace(parsed.data.placeId);

  revalidatePath("/admin/moderacion");
}
