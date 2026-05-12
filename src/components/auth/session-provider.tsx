"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
  children: React.ReactNode;
};

/**
 * Wrapper client-only del SessionProvider de Auth.js. Permite que componentes
 * client llamen `useSession().update(...)` para refrescar el JWT después de
 * editar perfil (avatar/nombre/bio). Sin esto el token cacheado mantendría
 * los valores viejos hasta el próximo login.
 */
export function SessionProvider({ session, children }: Props) {
  return (
    <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>
  );
}
