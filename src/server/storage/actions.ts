"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { auth } from "@/server/auth";
import { getUploadUrl, isStorageConfigured } from "./r2";

// 8 MB. Si en el futuro queremos thumbnails server-side podemos relajar esto.
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

const requestSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_SIZE_BYTES, `el archivo no puede pesar más de ${MAX_SIZE_BYTES / 1024 / 1024} MB`),
});

export type UploadUrlResult =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; error: string };

/**
 * Devuelve una URL firmada para subir una foto a R2 directamente desde el
 * cliente, más la URL pública resultante. El cliente la usa así:
 *
 *   const { uploadUrl, publicUrl } = await requestUploadUrl({...});
 *   await fetch(uploadUrl, { method: "PUT", body: file,
 *     headers: { "Content-Type": file.type } });
 *   // guardar publicUrl en el state del form, enviar al action al hacer submit
 */
export async function requestUploadUrl(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<UploadUrlResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "no autorizado" };
  }
  if (!isStorageConfigured()) {
    return {
      ok: false,
      error: "modo demo: configurá las vars R2_* en .env.local",
    };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "datos inválidos" };
  }

  const ext = parsed.data.contentType.split("/")[1] ?? "bin";
  const random = randomBytes(6).toString("hex");
  const key = `uploads/${session.user.id}/${Date.now()}-${random}.${ext}`;

  const urls = await getUploadUrl({
    key,
    contentType: parsed.data.contentType,
  });

  return { ok: true, ...urls };
}
