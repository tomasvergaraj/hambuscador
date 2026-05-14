"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import {
  createBrand,
  deleteBrand,
  updateBrand,
} from "@/server/services/brands";

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const colorRe = /^#[0-9a-fA-F]{6}$/;

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(slugRe, "slug ASCII kebab-case (a-z, 0-9, -)"),
  name: z.string().trim().min(1).max(80),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  color: z
    .string()
    .trim()
    .regex(colorRe, "color hex tipo #FFAA22")
    .optional()
    .or(z.literal("")),
  website: z.string().trim().url().optional().or(z.literal("")),
});

const updateSchema = createSchema.omit({ slug: true }).extend({
  isActive: z.coerce.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("no autorizado");
  }
}

export async function createBrandAction(formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || "",
    color: formData.get("color") || "",
    website: formData.get("website") || "",
  });
  if (!parsed.success) {
    throw new Error(
      "datos inválidos: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const brand = await createBrand({
    slug: parsed.data.slug,
    name: parsed.data.name,
    logoUrl: parsed.data.logoUrl || null,
    color: parsed.data.color || null,
    website: parsed.data.website || null,
  });

  revalidateTag("places");
  revalidatePath("/admin/brands");
  redirect(`/admin/brands/${brand.id}`);
}

export async function updateBrandAction(brandId: string, formData: FormData) {
  await requireAdmin();
  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || "",
    color: formData.get("color") || "",
    website: formData.get("website") || "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    throw new Error(
      "datos inválidos: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  await updateBrand(brandId, {
    name: parsed.data.name,
    logoUrl: parsed.data.logoUrl || null,
    color: parsed.data.color || null,
    website: parsed.data.website || null,
    isActive: parsed.data.isActive ?? true,
  });

  revalidateTag("places");
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${brandId}`);
}

export async function deleteBrandAction(brandId: string) {
  await requireAdmin();
  await deleteBrand(brandId);
  revalidateTag("places");
  revalidatePath("/admin/brands");
  redirect("/admin/brands");
}
