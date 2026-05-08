"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { approveClaim, rejectClaim } from "@/server/services/claims";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/iniciar-sesion");
  if (session.user.role !== "admin") redirect("/");
  return session.user.id;
}

export async function approveClaimAction(formData: FormData) {
  if (!isDbConfigured()) return;
  const adminId = await requireAdmin();
  const claimId = z.string().uuid().parse(formData.get("claimId"));
  await approveClaim(claimId, adminId);
  revalidateTag("places");
  revalidatePath("/admin/claims");
}

export async function rejectClaimAction(formData: FormData) {
  if (!isDbConfigured()) return;
  const adminId = await requireAdmin();
  const claimId = z.string().uuid().parse(formData.get("claimId"));
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  await rejectClaim(claimId, adminId, reason);
  revalidatePath("/admin/claims");
}
