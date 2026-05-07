import { IconList } from "@tabler/icons-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { HomeSearchInput } from "@/components/place/home-search-input";
import { PlaceCard } from "@/components/place/place-card";
import { UseLocationButton } from "@/components/place/use-location-button";
import { Chip } from "@/components/ui/chip";
import { getPlacesNearby, getRecentlyApprovedPlaces } from "@/lib/data";
import { GEO_COOKIE_NAME, parseGeoCookie } from "@/lib/geo";
import { initialsFromName } from "@/lib/utils";
import { auth } from "@/server/auth";

// Atajos: links a /buscar con filtros pre-aplicados. NO son toggles, son
// entry points de discovery.
const QUICK_LINKS: Array<{ label: string; href: string }> = [
  { label: "abierto ahora", href: "/buscar?abierto=1" },
  { label: "smash", href: "/buscar?cocina=smash" },
  { label: "veggie", href: "/buscar?cocina=vegetariana" },
  { label: "vegana", href: "/buscar?cocina=vegana" },
  { label: "barato", href: "/buscar?precio=%24%2C%24%24" },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const coords = parseGeoCookie(cookieStore.get(GEO_COOKIE_NAME)?.value);

  const [places, recent, session] = await Promise.all([
    getPlacesNearby(coords ? { ...coords, radiusM: 15_000 } : undefined),
    getRecentlyApprovedPlaces(4),
    auth(),
  ]);

  const nearby = places.slice(0, 3);
  const avatarInitials = session?.user?.name ? initialsFromName(session.user.name) : undefined;

  return (
    <main className="min-h-screen pb-24">
      <Header avatarInitials={avatarInitials} />

      <section className="px-4 pt-2">
        <h1 className="font-display font-semibold text-[28px] leading-[1.05] text-carbon">
          encuentra la picá perfecta
        </h1>
        <p className="text-xs text-tinta-suave mt-1.5">
          descubre y califica las mejores hamburgueserías de Chile
        </p>
      </section>

      <section className="px-4 mt-4">
        <HomeSearchInput />
      </section>

      <section
        className="px-4 mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
        aria-label="Atajos"
      >
        {/* "cerca" es el único chip que refleja estado, los demás son links a filtros */}
        <Link href="/buscar" className="shrink-0">
          <Chip active={!!coords}>cerca</Chip>
        </Link>
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0">
            <Chip>{link.label}</Chip>
          </Link>
        ))}
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-baseline justify-between mb-1.5">
          <h2 className="font-display font-semibold text-base text-carbon">
            {coords ? "cerca de ti" : "los mejor calificados"}
          </h2>
          <UseLocationButton hasCoords={!!coords} />
        </div>
        <p className="text-[11px] text-bronceado mb-2.5">
          {coords
            ? "ordenadas por distancia desde tu ubicación"
            : "activa la ubicación para ver las que están más cerca"}
        </p>
        <div className="flex flex-col gap-2">
          {nearby.map((place) => (
            <PlaceCard key={place.id} place={place} variant="compact" />
          ))}
        </div>
        <div className="text-right mt-2">
          <Link
            href="/buscar"
            className="text-xs text-tomate font-medium hover:opacity-80"
          >
            ver todo →
          </Link>
        </div>
      </section>

      {/* CTA picas curadas */}
      <section className="px-4 mt-6">
        <Link
          href="/picas"
          className="block bg-carbon text-crema rounded-2xl px-4 py-4 transition-[transform,colors] duration-150 active:scale-[0.99] hover:bg-carbon-soft"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-mostaza/20 inline-flex items-center justify-center text-mostaza shrink-0">
              <IconList size={22} stroke={2} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm">listas para no errarle</p>
              <p className="text-xs text-crema-deep/80 mt-0.5">
                top smash, veggie, baratas, para celebrar
              </p>
            </div>
            <span className="text-mostaza font-medium text-sm shrink-0">ver →</span>
          </div>
        </Link>
      </section>

      {recent.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="font-display font-semibold text-base text-carbon">
              recién agregadas
            </h2>
          </div>
          <p className="text-[11px] text-bronceado mb-2.5">
            las picás más nuevas, aportadas por la comunidad
          </p>
          <div className="grid grid-cols-1 gap-3">
            {recent.slice(0, 2).map((place) => (
              <PlaceCard key={place.id} place={place} variant="featured" />
            ))}
          </div>
        </section>
      )}

      {/* CTA UGC: cierra el loop "tú también puedes sumar tu picá" */}
      <section className="px-4 mt-6">
        <Link
          href="/agregar"
          className="block bg-mostaza/15 border border-mostaza/40 rounded-2xl px-4 py-4 transition-[transform,colors] duration-150 active:scale-[0.99] hover:bg-mostaza/20"
        >
          <p className="font-display font-semibold text-sm text-carbon">
            ¿conoces una picá que falta?
          </p>
          <p className="text-xs text-tinta-suave mt-1">
            agrégala y aparecerá acá apenas la revisemos
          </p>
          <span className="mt-2 inline-block text-xs text-tomate font-medium">
            agregar mi picá →
          </span>
        </Link>
      </section>

      <BottomNav />
    </main>
  );
}
