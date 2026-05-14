import { IconTrash } from "@tabler/icons-react";
import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import { getPromotionById } from "@/server/services/promotions";

import {
  ownerDeletePromotionAction,
  ownerUpdatePromotionAction,
} from "../../actions";
import { DeleteOwnerPromoButton } from "./delete-button";
import { PromoForm } from "@/app/admin/ofertas/promo-form";

export const metadata = { title: "editar oferta" };
export const dynamic = "force-dynamic";

type Params = { placeId: string; id: string };

export default async function EditOfertaOwnerPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { placeId, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/mi-local/${placeId}/ofertas/${id}/editar`);
  }
  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const promo = await getPromotionById(id);
  if (!promo || promo.placeId !== placeId) notFound();

  const bindUpdate = ownerUpdatePromotionAction.bind(null, placeId, id);
  const bindDelete = ownerDeletePromotionAction.bind(null, placeId, id);

  return (
    <div className="flex flex-col min-h-screen pb-12">
      <Header title="editar oferta" backHref={`/mi-local/${placeId}/ofertas`} />

      <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
        <p className="text-xs text-tinta-suave mb-4">
          después de editar, la oferta vuelve a estado{" "}
          <code>pending</code> y el admin la revisa.
        </p>

        <PromoForm mode="edit" promo={promo} action={bindUpdate} />

        <section className="mt-6 bg-tomate/5 border border-tomate/30 rounded-xl p-4">
          <h2 className="font-display font-semibold text-sm text-carbon mb-2">
            <IconTrash size={14} className="inline mr-1" aria-hidden="true" />
            borrar
          </h2>
          <DeleteOwnerPromoButton title={promo.title} action={bindDelete} />
        </section>
      </main>
    </div>
  );
}
