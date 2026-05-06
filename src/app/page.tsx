import Link from "next/link";
import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SearchBar } from "@/components/ui/search-bar";
import { Chip } from "@/components/ui/chip";
import { PlaceCard } from "@/components/place/place-card";
import { getPlacesNearby } from "@/lib/data";
import { auth } from "@/server/auth";
import { initialsFromName } from "@/lib/utils";

export default async function HomePage() {
  const [places, session] = await Promise.all([getPlacesNearby(), auth()]);
  const nearby = places.slice(0, 3);
  const trending = places.slice(0, 2);
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
        <SearchBar />
      </section>

      <section
        className="px-4 mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
        aria-label="Filtros rápidos"
      >
        <Chip active>cerca</Chip>
        <Chip>abierto</Chip>
        <Chip>smash</Chip>
        <Chip>vegetariano</Chip>
        <Chip>$$$ o menos</Chip>
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="font-display font-semibold text-base text-carbon">
            cerca de ti
          </h2>
          <Link
            href="/buscar?cerca=1"
            className="text-xs text-tomate font-medium hover:opacity-80"
          >
            ver todo →
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {nearby.map((place) => (
            <PlaceCard key={place.id} place={place} variant="compact" />
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="font-display font-semibold text-base text-carbon">
            trending esta semana
          </h2>
          <Link
            href="/picas"
            className="text-xs text-tomate font-medium hover:opacity-80"
          >
            ver listas →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {trending.map((place) => (
            <PlaceCard key={place.id} place={place} variant="featured" />
          ))}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
