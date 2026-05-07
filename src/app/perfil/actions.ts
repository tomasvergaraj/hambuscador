"use server";

import { signOut } from "@/server/auth";

/**
 * Cierra la sesión y vuelve al home. `signOut` con `redirectTo` lanza
 * NEXT_REDIRECT, que Next propaga al cliente.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
