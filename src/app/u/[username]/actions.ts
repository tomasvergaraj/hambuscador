"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/server/auth";
import { followUser, unfollowUser } from "@/server/services/follows";
import { getUserByUsername } from "@/server/services/users";

/**
 * Toggle follow/unfollow al user `targetUsername`. El cliente envía el
 * estado actual `currentlyFollowing` para que sepamos qué hacer sin tener
 * que consultar antes (ahorra una query). Si el cliente miente, hacemos
 * lo que pide igual (idempotente: follow → ON CONFLICT NOTHING, unfollow
 * sobre nada → no-op).
 */
export async function toggleFollowAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const targetUsername = String(formData.get("username") ?? "");
  const currentlyFollowing = formData.get("currentlyFollowing") === "1";
  if (!targetUsername) return;

  const target = await getUserByUsername(targetUsername.toLowerCase());
  if (!target) return;
  if (target.id === session.user.id) return; // self-follow rechazado

  if (currentlyFollowing) {
    await unfollowUser(session.user.id, target.id);
  } else {
    await followUser(session.user.id, target.id);
  }

  revalidatePath(`/u/${targetUsername.toLowerCase()}`);
  revalidatePath("/perfil");
}
