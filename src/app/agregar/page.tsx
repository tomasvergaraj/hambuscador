import { redirect } from "next/navigation";

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
 */
export default async function AgregarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  return <AgregarWizard />;
}
