import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPromotionById } from "@/server/services/promotions";

import { deletePromotionAction, updatePromotionAction } from "../actions";
import { PromoForm } from "../promo-form";
import { DeletePromoButton } from "./delete-button";

export const metadata = { title: "admin · oferta" };
export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function AdminPromoDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const promo = await getPromotionById(id);
  if (!promo) notFound();

  const boundUpdate = updatePromotionAction.bind(null, id);
  const boundDelete = deletePromotionAction.bind(null, id);

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <header className="mb-4">
        <Link
          href="/admin/ofertas"
          className="text-xs text-bronceado hover:text-carbon"
        >
          ← volver
        </Link>
        <div className="flex items-baseline justify-between mt-1">
          <h1 className="font-display font-semibold text-xl text-carbon truncate">
            {promo.title}
          </h1>
          <Link
            href={`/admin/places/${promo.placeId}/edit`}
            className="text-xs text-bronceado hover:text-carbon inline-flex items-center gap-1"
          >
            <IconExternalLink size={12} /> place
          </Link>
        </div>
      </header>

      <PromoForm mode="edit" promo={promo} action={boundUpdate} />

      <section className="mt-6 bg-tomate/5 border border-tomate/30 rounded-xl p-4">
        <h2 className="font-display font-semibold text-sm text-carbon mb-2">
          <IconTrash size={14} className="inline mr-1" aria-hidden="true" />
          borrar oferta
        </h2>
        <p className="text-xs text-tinta-suave">
          Eliminar definitivo. Si solo quieres pausar, desactiva el toggle
          arriba.
        </p>
        <DeletePromoButton title={promo.title} action={boundDelete} />
      </section>
    </main>
  );
}
