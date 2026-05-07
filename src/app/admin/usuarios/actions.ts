"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/server/auth";
import { isDbConfigured } from "@/server/db/client";
import { banUser, setUserRole, unbanUser } from "@/server/services/users";

// ============================================================================
// Server actions del panel /admin/usuarios. Doble guard (sesión + rol admin)
// porque las server actions se exponen como endpoints HTTP.
// ============================================================================

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
});

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }
  return session.user.id;
}

export async function banUserAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;
  const adminId = await assertAdmin();

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return;

  // No te puedes auto-banear (evita lockout)
  if (parsed.data.userId === adminId) return;

  await banUser(parsed.data.userId);
  revalidatePath("/admin/usuarios");
}

export async function unbanUserAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;
  await assertAdmin();

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return;

  await unbanUser(parsed.data.userId);
  revalidatePath("/admin/usuarios");
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  if (!isDbConfigured()) return;
  const adminId = await assertAdmin();

  const parsed = setRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;

  // No te puedes auto-degradar (evita lockout del último admin)
  if (parsed.data.userId === adminId && parsed.data.role !== "admin") return;

  await setUserRole(parsed.data.userId, parsed.data.role);
  revalidatePath("/admin/usuarios");
}
