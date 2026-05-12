import { initialsFromName } from "@/lib/utils";
import { auth } from "@/server/auth";

import { BottomNavClient } from "./bottom-nav-client";

/**
 * Wrapper server-side: lee `auth()` y pasa avatar/iniciales al cliente para
 * que el tab "perfil" muestre la foto real del user cuando hay sesión.
 *
 * El componente cliente se encarga del `usePathname` y los estilos. Esto
 * mantiene transparente la API: cada page que importa `BottomNav` no necesita
 * pasar nada — el wrapper hidrata desde la sesión.
 */
export async function BottomNav() {
  const session = await auth();
  const name = session?.user?.name ?? null;
  const avatarInitials = name ? initialsFromName(name) : undefined;
  const avatarImage = session?.user?.image ?? null;

  return <BottomNavClient avatarImage={avatarImage} avatarInitials={avatarInitials} />;
}
