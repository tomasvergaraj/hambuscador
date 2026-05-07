import Link from "next/link";

import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { PicaIcon } from "@/components/place/pica-icon";
import { getPicasListsWithCounts } from "@/lib/data";

export const metadata = {
  title: "picas — listas curadas",
  description:
    "Las hamburgueserías que valen la pena, organizadas por estilo, presupuesto y barrio. Listas armadas con cariño.",
};

export default async function PicasIndexPage() {
  const items = await getPicasListsWithCounts();

  return (
    <main className="min-h-screen pb-24">
      <Header title="picas" subtitle="listas curadas" />

      <section className="px-4 pt-4">
        <h1 className="font-display font-semibold text-[26px] leading-[1.05] text-carbon">
          listas para no errarle
        </h1>
        <p className="text-xs text-tinta-suave mt-1.5">
          armadas por estilo, presupuesto o barrio. cuando no sepas qué pedir, abrí una.
        </p>
      </section>

      <section className="px-4 mt-5 grid grid-cols-1 gap-3">
        {items.map(({ list, count, preview }) => (
          <Link
            key={list.slug}
            href={`/picas/${list.slug}`}
            className="group block rounded-2xl border border-crema-edge bg-white overflow-hidden transition-[transform,colors,box-shadow] duration-150 active:scale-[0.99] hover:shadow-md"
          >
            {/* Banda superior con icono + count */}
            <div className="relative px-4 py-5 bg-gradient-to-br from-mostaza/15 to-mostaza/5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-mostaza/30 flex items-center justify-center text-carbon shrink-0">
                <PicaIcon name={list.icon} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-semibold text-base text-carbon leading-tight">
                  {list.title}
                </h2>
                <p className="text-xs text-tinta-suave mt-0.5 truncate">
                  {list.hook}
                </p>
              </div>
              <span className="inline-flex items-center justify-center bg-carbon text-crema text-xs font-semibold rounded-full px-2.5 py-1 shrink-0">
                {count}
              </span>
            </div>

            {preview ? (
              <div className="px-4 py-3 flex items-center justify-between gap-2 border-t border-crema-edge">
                <p className="text-xs text-tinta-suave truncate">
                  empezando por <span className="text-carbon font-semibold">{preview.name}</span>{" "}
                  · {preview.comunaLabel}
                </p>
                <span className="text-xs text-tomate font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                  abrir →
                </span>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-crema-edge">
                <p className="text-xs text-bronceado">aún no hay locales en esta lista</p>
              </div>
            )}
          </Link>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
