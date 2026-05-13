"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import {
  createPicasList,
  deletePicasList,
  updatePicasList,
} from "@/server/services/picas-lists";

const iconEnum = z.enum(["flame", "leaf", "coin", "sparkles", "map-pin"]);

const cuisineEnum = z.enum([
  "smash",
  "artesanal",
  "clasica",
  "gourmet",
  "vegetariana",
  "vegana",
  "sin-gluten",
  "fast-food",
]);

const priceEnum = z.enum(["$", "$$", "$$$", "$$$$"]);

const criteriaSchema = z
  .object({
    cuisines: z.array(cuisineEnum).optional(),
    priceRanges: z.array(priceEnum).optional(),
    comunaSlug: z.string().optional(),
    regionLabel: z.string().optional(),
    minRating: z.number().min(0).max(5).optional(),
    approvedWithinDays: z.number().int().positive().optional(),
    openAfterHour: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  })
  .strict();

const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "slug solo permite minúsculas, números y guiones");

const baseInputSchema = z.object({
  title: z.string().min(2).max(60),
  hook: z.string().min(2).max(200),
  intro: z.string().min(10).max(1000),
  icon: iconEnum,
  maxItems: z.number().int().min(1).max(50),
  sortOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
  criteria: criteriaSchema,
});

const createSchema = baseInputSchema.extend({ slug: slugSchema });
const updateSchema = baseInputSchema;

export type ActionState = {
  ok: boolean;
  error?: string;
};

function parseCsv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const arr = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

function parseNumber(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readCriteriaFromForm(fd: FormData) {
  return {
    cuisines: parseCsv(fd.get("criteria_cuisines") as string | null),
    priceRanges: parseCsv(fd.get("criteria_priceRanges") as string | null),
    comunaSlug:
      (fd.get("criteria_comunaSlug") as string | null)?.trim() || undefined,
    regionLabel:
      (fd.get("criteria_regionLabel") as string | null)?.trim() || undefined,
    minRating: parseNumber(fd.get("criteria_minRating") as string | null),
    approvedWithinDays: parseNumber(
      fd.get("criteria_approvedWithinDays") as string | null,
    ),
    openAfterHour:
      (fd.get("criteria_openAfterHour") as string | null)?.trim() || undefined,
  };
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Solo admins.");
  }
}

function invalidateCaches() {
  revalidateTag("picas-lists");
  revalidatePath("/picas");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/picas");
}

export async function createPicasListAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse({
      slug: (fd.get("slug") as string | null)?.trim(),
      title: (fd.get("title") as string | null)?.trim(),
      hook: (fd.get("hook") as string | null)?.trim(),
      intro: (fd.get("intro") as string | null)?.trim(),
      icon: fd.get("icon"),
      maxItems: parseNumber(fd.get("maxItems") as string | null),
      sortOrder: parseNumber(fd.get("sortOrder") as string | null) ?? 100,
      isActive: fd.get("isActive") === "on",
      criteria: readCriteriaFromForm(fd),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "datos inválidos" };
    }
    await createPicasList({
      slug: parsed.data.slug,
      title: parsed.data.title,
      hook: parsed.data.hook,
      intro: parsed.data.intro,
      icon: parsed.data.icon,
      maxItems: parsed.data.maxItems,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      criteria: parsed.data.criteria,
    });
    invalidateCaches();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
  redirect("/admin/picas");
}

export async function updatePicasListAction(
  slug: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const parsed = updateSchema.safeParse({
      title: (fd.get("title") as string | null)?.trim(),
      hook: (fd.get("hook") as string | null)?.trim(),
      intro: (fd.get("intro") as string | null)?.trim(),
      icon: fd.get("icon"),
      maxItems: parseNumber(fd.get("maxItems") as string | null),
      sortOrder: parseNumber(fd.get("sortOrder") as string | null) ?? 100,
      isActive: fd.get("isActive") === "on",
      criteria: readCriteriaFromForm(fd),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "datos inválidos" };
    }
    await updatePicasList(slug, {
      title: parsed.data.title,
      hook: parsed.data.hook,
      intro: parsed.data.intro,
      icon: parsed.data.icon,
      maxItems: parsed.data.maxItems,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      criteria: parsed.data.criteria,
    });
    invalidateCaches();
    revalidatePath(`/picas/${slug}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function deletePicasListAction(slug: string): Promise<void> {
  await requireAdmin();
  await deletePicasList(slug);
  invalidateCaches();
  redirect("/admin/picas");
}
