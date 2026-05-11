import { cookies } from "next/headers";
import Link from "next/link";

import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { PicaIcon } from "@/components/place/pica-icon";
import { getActiveRegions, getPicasListsWithCounts } from "@/lib/data";
import { findClosestRegion, GEO_COOKIE_NAME, parseGeoCookie } from "@/lib/geo";
import type { PicasList } from "@/lib/picas";

export const metadata = {
  title: "picás — listas curadas",
  description:
    "Las hamburgueserías que valen la pena, organizadas por estilo, presupuesto y barrio. Listas armadas con cariño.",
};

type PicaItem = { list: PicasList; count: number; preview: Awaited<ReturnType<typeof getPicasListsWithCounts>>[number]["preview"] };

function isRegional(list: PicasList): boolean {
  return Boolean(list.criteria.regionLabel);
}

export default async function PicasIndexPage() {
  const items = await getPicasListsWithCounts();

  // Detectar región del usuario desde la cookie hb_geo (opt-in).
  const cookieStore = await cookies();
  const geo = parseGeoCookie(cookieStore.get(GEO_COOKIE_NAME)?.value);
  let userRegionLabel: string | null = null;
  if (geo) {
    const regions = await getActiveRegions();
    const closest = findClosestRegion(geo, regions);
    userRegionLabel = closest?.label ?? null;
  }

  // Particionar.
  const thematic: PicaItem[] = items.filter((it) => !isRegional(it.list));
  const regional: PicaItem[] = items.filter((it) => isRegional(it.list));
  const userRegional = userRegionLabel
    ? regional.find((it) => it.list.criteria.regionLabel === userRegionLabel) ?? null
    : null;
  const otherRegional = regional.filter(
    (it) => it !== userRegional && it.count > 0,
  );

  return (
    <main className="min-h-screen pb-24">
      <Header title="picás" subtitle="listas curadas" backHref="/" />

      <section className="px-4 pt-4">
        <h1 className="font-display font-semibold text-[26px] leading-[1.05] text-carbon">
          listas para no errarle
        </h1>
        <p className="text-xs text-tinta-suave mt-1.5">
          armadas por estilo, presupuesto o región. cuando no sepas qué pedir, abrí una.
        </p>
      </section>

      {userRegional && userRegional.count > 0 ? (
        <Section title="cerca tuyo" subtitle="lo mejor de tu región">
          <PicaCard item={userRegional} />
        </Section>
      ) : null}

      <Section title="para todos" subtitle="rankings y temáticas nacionales">
        {thematic.map((it) => (
          <PicaCard key={it.list.slug} item={it} />
        ))}
      </Section>

      {otherRegional.length > 0 ? (
        <Section
          title="explorar Chile"
          subtitle={
            userRegional
              ? "otras regiones con escena propia"
              : "lo mejor de cada región"
          }
        >
          {otherRegional.map((it) => (
            <PicaCard key={it.list.slug} item={it} />
          ))}
        </Section>
      ) : null}

      <BottomNav />
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 mt-6">
      <header className="mb-3">
        <h2 className="font-display font-semibold text-base text-carbon leading-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-tinta-suave mt-0.5">{subtitle}</p>
        ) : null}
      </header>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </section>
  );
}

function PicaCard({ item }: { item: PicaItem }) {
  const { list, count, preview } = item;
  return (
    <Link
      href={`/picas/${list.slug}`}
      className="group block rounded-2xl border border-crema-edge bg-white overflow-hidden transition-[transform,colors,box-shadow] duration-150 active:scale-[0.99] hover:shadow-md"
    >
      <div className="relative px-4 py-5 bg-gradient-to-br from-mostaza/15 to-mostaza/5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-mostaza/30 flex items-center justify-center text-carbon shrink-0">
          <PicaIcon name={list.icon} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base text-carbon leading-tight">
            {list.title}
          </h3>
          <p className="text-xs text-tinta-suave mt-0.5 truncate">{list.hook}</p>
        </div>
        <span className="inline-flex items-center justify-center bg-carbon text-crema text-xs font-semibold rounded-full px-2.5 py-1 shrink-0">
          {count}
        </span>
      </div>

      {preview ? (
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-t border-crema-edge">
          <p className="text-xs text-tinta-suave truncate">
            empezando por{" "}
            <span className="text-carbon font-semibold">{preview.name}</span>{" "}
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
  );
}
