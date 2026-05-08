import {
  IconBuildingStore,
  IconChevronRight,
  IconHeart,
  IconStar,
} from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { cn, initialsFromName } from "@/lib/utils";
import {
  getMyFavorites,
  getMyReviews,
  getMySubmissions,
  getUserByUsername,
  getUserStats,
  type MyFavoriteItem,
  type MyReviewItem,
  type MySubmissionItem,
} from "@/server/services/users";

// ============================================================================
// Perfil público de un usuario por username. 404 si no existe el username, si
// el usuario no tiene username seteado, o si está baneado (handled in svc).
// Sin sesión también es accesible — engagement Fase 5.
// ============================================================================

const TABS = ["resenas", "favoritos", "aportes"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  resenas: "reseñas",
  favoritos: "favoritos",
  aportes: "aportes",
};

type SearchParams = { tab?: string };

function parseTab(value: string | undefined): Tab {
  return TABS.find((t) => t === value) ?? "resenas";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getUserByUsername(username.toLowerCase());
  if (!user) return { title: "perfil no encontrado" };
  const name = user.name ?? `@${user.username}`;
  return {
    title: `${name} en hambuscador`,
    description: `Reseñas, favoritos y aportes de ${name} en hambuscador.`,
  };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ username: rawUsername }, { tab: tabParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const username = rawUsername.toLowerCase();
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const tab = parseTab(tabParam);

  // Approved-only para no exponer pending/rejected ajenos.
  const [stats, list] = await Promise.all([
    getUserStats(user.id, { approvedOnly: true }),
    tab === "resenas"
      ? getMyReviews(user.id)
      : tab === "favoritos"
        ? getMyFavorites(user.id)
        : getMySubmissions(user.id, { approvedOnly: true }),
  ]);

  const displayName = user.name ?? `@${user.username}`;
  const initials = initialsFromName(displayName);
  const memberSince = formatMemberSince(user.createdAt);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title={`@${user.username}`} backHref="/" />

      <main className="px-4 pt-4 flex-1 flex flex-col gap-4">
        <section className="bg-crema-deep border border-crema-edge rounded-xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-mostaza-deep text-carbon flex items-center justify-center font-display font-semibold text-lg">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-base text-carbon truncate">
              {displayName}
            </p>
            <p className="text-xs text-tinta-suave">miembro desde {memberSince}</p>
            {user.bio ? (
              <p className="text-xs text-tinta-suave mt-1 line-clamp-2 leading-relaxed">
                {user.bio}
              </p>
            ) : null}
          </div>
        </section>

        <section aria-label="actividad">
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<IconStar size={18} />}
              value={stats.reviewCount.toLocaleString("es-CL")}
              label={stats.reviewCount === 1 ? "reseña" : "reseñas"}
            />
            <StatCard
              icon={<IconHeart size={18} />}
              value={stats.favoriteCount.toLocaleString("es-CL")}
              label="favoritos"
            />
            <StatCard
              icon={<IconBuildingStore size={18} />}
              value={stats.placeCount.toLocaleString("es-CL")}
              label={stats.placeCount === 1 ? "aporte" : "aportes"}
            />
          </div>
        </section>

        <nav aria-label="cambiar lista" className="flex gap-2">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/u/${user.username}?tab=${t}`}
              scroll={false}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "flex-1 text-center text-xs font-medium rounded-md px-3 py-2 transition-[transform,colors] duration-150 active:scale-[0.97]",
                t === tab
                  ? "bg-mostaza text-carbon"
                  : "bg-crema-deep border border-crema-edge text-tinta-suave hover:text-carbon",
              )}
            >
              {TAB_LABEL[t]}
            </Link>
          ))}
        </nav>

        <section aria-label={TAB_LABEL[tab]}>
          {tab === "resenas" && (
            <ReviewsList items={list as MyReviewItem[]} name={displayName} />
          )}
          {tab === "favoritos" && (
            <FavoritesList items={list as MyFavoriteItem[]} name={displayName} />
          )}
          {tab === "aportes" && (
            <SubmissionsList items={list as MySubmissionItem[]} name={displayName} />
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

// ============================================================================
// Sub-componentes
// ============================================================================

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-md px-2 py-3 text-center">
      <div className="text-bronceado flex justify-center mb-1">{icon}</div>
      <p className="font-display font-semibold text-base text-carbon">{value}</p>
      <p className="text-[10px] text-tinta-suave mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-lg px-4 py-8 text-center">
      <p className="text-sm text-tinta-suave">{message}</p>
    </div>
  );
}

function ReviewsList({ items, name }: { items: MyReviewItem[]; name: string }) {
  if (items.length === 0) {
    return <EmptyState message={`${name} aún no califica picás.`} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/${r.place.comunaSlug}/${r.place.slug}`}
            className="block bg-crema-deep border border-crema-edge rounded-lg p-3 hover:border-mostaza/50 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-carbon truncate">{r.place.name}</p>
                <p className="text-[10px] text-bronceado">
                  {"★".repeat(r.rating)} · {r.place.comunaLabel} · hace{" "}
                  {daysSince(r.createdAt)}
                </p>
                {r.text ? (
                  <p className="text-xs text-tinta-suave mt-1.5 line-clamp-2 leading-relaxed">
                    {r.text}
                  </p>
                ) : null}
              </div>
              <IconChevronRight
                size={16}
                className="text-bronceado shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FavoritesList({ items, name }: { items: MyFavoriteItem[]; name: string }) {
  if (items.length === 0) {
    return <EmptyState message={`${name} aún no guarda favoritos.`} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((f) => (
        <li key={f.place.id}>
          <Link
            href={`/${f.place.comunaSlug}/${f.place.slug}`}
            className="block bg-crema-deep border border-crema-edge rounded-lg p-3 hover:border-mostaza/50 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-carbon truncate">{f.place.name}</p>
                <p className="text-[10px] text-bronceado">
                  {f.place.ratingAvg ? `${Number(f.place.ratingAvg).toFixed(1)} ★ · ` : ""}
                  {f.place.comunaLabel}
                </p>
              </div>
              <IconChevronRight
                size={16}
                className="text-bronceado shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SubmissionsList({
  items,
  name,
}: {
  items: MySubmissionItem[];
  name: string;
}) {
  if (items.length === 0) {
    return <EmptyState message={`${name} aún no aporta picás.`} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => (
        <li key={s.id}>
          <Link
            href={`/${s.comunaSlug}/${s.slug}`}
            className="block bg-crema-deep border border-crema-edge rounded-lg p-3 hover:border-mostaza/50 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-carbon truncate">{s.name}</p>
                <p className="text-[10px] text-bronceado">
                  {s.comunaLabel} · hace {daysSince(s.createdAt)}
                </p>
              </div>
              <IconChevronRight
                size={16}
                className="text-bronceado shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function daysSince(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  return `${Math.floor(days / 365)} años`;
}

function formatMemberSince(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
}
