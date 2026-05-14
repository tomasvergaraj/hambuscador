import Link from "next/link";

import { createBrandAction } from "../actions";
import { BrandForm } from "../brand-form";

export const metadata = { title: "admin · nueva cadena" };

export default function NuevaBrandPage() {
  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <header className="mb-4">
        <Link
          href="/admin/brands"
          className="text-xs text-bronceado hover:text-carbon"
        >
          ← volver
        </Link>
        <h1 className="font-display font-semibold text-xl text-carbon mt-1">
          nueva cadena
        </h1>
        <p className="text-xs text-tinta-suave mt-1 leading-relaxed">
          una cadena agrupa varios locales bajo una marca. El logo se usa en
          los pins del mapa de cada local asociado.
        </p>
      </header>

      <BrandForm mode="create" action={createBrandAction} />
    </main>
  );
}
