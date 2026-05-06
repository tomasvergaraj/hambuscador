import { notFound, redirect } from "next/navigation";

import { getPlaceBySlug } from "@/lib/data";
import { auth } from "@/server/auth";
import { CalificarForm } from "./calificar-form";

type Params = { comuna: string; slug: string };

/**
 * Server component que valida sesión, fetch del local y delega la UI
 * interactiva al client component CalificarForm. Patrón estándar de Next 15:
 * page server (data + guard) → form client (estado + action).
 *
 * Si no hay sesión, redirige a `/iniciar-sesion` antes de renderizar el form
 * para evitar que el usuario llene todo y pierda el input.
 */
export default async function CalificarPage({ params }: { params: Promise<Params> }) {
  const { comuna, slug } = await params;

  const [place, session] = await Promise.all([getPlaceBySlug(comuna, slug), auth()]);
  if (!place) notFound();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  return <CalificarForm place={place} />;
}
