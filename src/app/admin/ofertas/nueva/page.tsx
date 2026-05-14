import Link from "next/link";

import { createPromotionAction } from "../actions";
import { PromoForm } from "../promo-form";

export const metadata = { title: "admin · nueva oferta" };

type SearchParams = { placeId?: string };

export default async function NuevaOfertaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { placeId } = await searchParams;

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <header className="mb-4">
        <Link
          href="/admin/ofertas"
          className="text-xs text-bronceado hover:text-carbon"
        >
          ← volver
        </Link>
        <h1 className="font-display font-semibold text-xl text-carbon mt-1">
          nueva oferta
        </h1>
        <p className="text-xs text-tinta-suave mt-1 leading-relaxed">
          la oferta aparece en el carousel del home (filtrado por región) y
          en la ficha del local. requiere sub tier <code>promo</code> activa
          (admin puede crear sin restricción).
        </p>
      </header>

      <PromoForm
        mode="create"
        action={createPromotionAction}
        defaultPlaceId={placeId ?? null}
      />
    </main>
  );
}
