import { redirect } from "next/navigation";

import { getAllComunas } from "@/lib/data";
import { auth } from "@/server/auth";
import { AgregarWizard } from "./agregar-wizard";

export const metadata = {
  title: "agregar lugar",
  description: "Agrega una hamburguesería nueva al directorio de Hambuscador.",
};

/**
 * Wizard de 3 pasos para agregar una hamburguesería. Guard de sesión upfront
 * para no perder lo escrito si el usuario no está logueado. La ficha se crea
 * en estado `pending` y entra a moderación.
 *
 * Pasamos las 346 comunas como prop al wizard — payload ~28KB, vale el trade
 * de filter client-side sin round-trips por keystroke.
 */
export default async function AgregarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const comunas = await getAllComunas();
  return <AgregarWizard comunas={comunas} />;
}
