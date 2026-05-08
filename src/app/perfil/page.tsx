import {
  IconBuildingStore,
  IconChevronRight,
  IconHeart,
  IconLayoutDashboard,
  IconLogout,
  IconRosetteDiscountCheckFilled,
  IconStar,
} from "@tabler/icons-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { Button } from "@/components/ui/button";
import { cn, initialsFromName } from "@/lib/utils";
import { auth } from "@/server/auth";
import { getMyOwnedPlaces } from "@/server/services/claims";
import { countPendingPlaces } from "@/server/services/places";
import {
  getMyFavorites,
  getMyReviews,
  getMySubmissions,
  getUserById,
  getUserStats,
  type MyFavoriteItem,
  type MyReviewItem,
  type MySubmissionItem,
} from "@/server/services/users";
import { signOutAction } from "./actions";
import { UsernameSetter } from "./username-setter";

export const metadata = {
  title: "mi perfil",
};

const TABS = ["resenas", "favoritos", "aportes"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  resenas: "reseñas",
  favoritos: "favoritos",
  aportes: "aportes",
};

type SearchParams = { nuevo?: string; tab?: string };

function parseTab(value: string | undefined): Tab {
  return TABS.find((t) => t === value) ?? "resenas";
}

/**
 * Perfil del usuario logueado. Si no hay sesión redirige a `/iniciar-sesion`.
 * Lee `?nuevo=1` (viene del redirect de `/agregar`) para mostrar un banner
 * de confirmación. `?tab=resenas|favoritos|aportes` controla qué lista se
 * renderiza.
 */
export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }

  const { nuevo, tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  // Pedimos stats + user (para username) + la lista de la tab activa.
  // Si es admin sumamos count de pendientes para el badge del shortcut.
  // ownedPlaces lista locales reclamados aprobados — atajo a editar.
  const [stats, dbUser, list, pendingCount, ownedPlaces] = await Promise.all([
    getUserStats(userId),
    getUserById(userId),
    tab === "resenas"
      ? getMyReviews(userId)
      : tab === "favoritos"
        ? getMyFavorites(userId)
        : getMySubmissions(userId),
    isAdmin ? countPendingPlaces() : Promise.resolve(0),
    getMyOwnedPlaces(userId),
  ]);

  const showSubmittedBanner = nuevo === "1";

  const name = session.user.name ?? "tú";
  const email = session.user.email ?? "";
  const initials = initialsFromName(name);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="mi perfil" />

      <main className="px-4 pt-4 flex-1 flex flex-col gap-4">
        {showSubmittedBanner ? (
          <div
            role="status"
            className="rounded-md bg-mostaza/15 border border-mostaza/40 px-3 py-3"
          >
            <p className="text-sm font-display font-semibold text-carbon">
              ¡filete! tu picá está en revisión
            </p>
            <p className="text-xs text-tinta-suave mt-0.5 leading-relaxed">
              te avisamos cuando se apruebe y aparezca en el directorio.
            </p>
          </div>
        ) : null}

        {/* Tarjeta de identidad */}
        <section className="bg-crema-deep border border-crema-edge rounded-xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-mostaza-deep text-carbon flex items-center justify-center font-display font-semibold text-lg">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-base text-carbon truncate">{name}</p>
            {email ? (
              <p className="text-xs text-tinta-suave truncate">{email}</p>
            ) : null}
          </div>
        </section>

        <UsernameSetter currentUsername={dbUser?.username ?? null} />

        {/* Mis locales — visible si el user es owner verificado de al menos
            uno. Cada item linkea al editor restringido. */}
        {ownedPlaces.length > 0 && (
          <section aria-label="mis locales" className="flex flex-col gap-2">
            <h2 className="font-display font-semibold text-sm text-carbon px-1">
              mis locales ({ownedPlaces.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {ownedPlaces.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/mi-local/${p.id}/editar`}
                    className="flex items-center gap-3 bg-mostaza/10 border border-mostaza/30 rounded-lg p-3 hover:bg-mostaza/15 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-md bg-mostaza text-carbon flex items-center justify-center shrink-0">
                      <IconRosetteDiscountCheckFilled size={18} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-carbon truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-bronceado truncate">
                        {p.comunaLabel} · editar ficha
                      </p>
                    </div>
                    <IconChevronRight
                      size={16}
                      className="text-mostaza-deep shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Acceso rápido al modo admin — solo para usuarios con role=admin.
            Carbon background + mostaza accent para que destaque del resto
            del perfil. Badge con count de pendientes cuando hay. */}
        {isAdmin && (
          <Link
            href="/admin/moderacion"
            className="flex items-center gap-3 bg-carbon text-crema rounded-xl p-4 hover:bg-carbon-soft transition-[transform,colors,box-shadow] duration-150 active:scale-[0.98] hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-md bg-mostaza text-carbon flex items-center justify-center shrink-0">
              <IconLayoutDashboard size={20} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm">panel admin</p>
              <p className="text-[11px] text-crema/70">
                moderar pendientes y administrar locales
              </p>
            </div>
            {pendingCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-medium bg-mostaza text-carbon rounded-full shrink-0"
                aria-label={`${pendingCount} pendientes`}
              >
                {pendingCount}
              </span>
            )}
            <IconChevronRight
              size={18}
              className="text-crema/60 shrink-0"
              aria-hidden="true"
            />
          </Link>
        )}

        {/* Stats */}
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

        {/* Tabs */}
        <nav aria-label="cambiar lista" className="flex gap-2">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/perfil?tab=${t}`}
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

        {/* Lista de la tab activa */}
        <section aria-label={TAB_LABEL[tab]}>
          {tab === "resenas" && (
            <ReviewsList items={list as MyReviewItem[]} />
          )}
          {tab === "favoritos" && (
            <FavoritesList items={list as MyFavoriteItem[]} />
          )}
          {tab === "aportes" && (
            <SubmissionsList items={list as MySubmissionItem[]} />
          )}
        </section>

        <div className="flex-1" />

        <form action={signOutAction}>
          <Button variant="secondary" size="lg" fullWidth type="submit">
            <IconLogout size={18} aria-hidden="true" /> cerrar sesión
          </Button>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}

// ============================================================================
// Sub-componentes (server, sin estado)
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

function EmptyState({ message, cta }: { message: string; cta?: { href: string; label: string } }) {
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-lg px-4 py-8 text-center">
      <p className="text-sm text-tinta-suave">{message}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-block mt-3 text-xs font-medium text-tomate hover:opacity-80"
        >
          {cta.label} →
        </Link>
      ) : null}
    </div>
  );
}

function ReviewsList({ items }: { items: MyReviewItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        message="aún no calificas ninguna picá."
        cta={{ href: "/buscar", label: "buscar dónde comer" }}
      />
    );
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

function FavoritesList({ items }: { items: MyFavoriteItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        message="aún no guardas picás favoritas."
        cta={{ href: "/buscar", label: "explorar locales" }}
      />
    );
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

function SubmissionsList({ items }: { items: MySubmissionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        message="aún no aportas picás al directorio."
        cta={{ href: "/agregar", label: "agregar una picá" }}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => {
        // Solo los aprobados son páginas públicas; los pending/rejected no linkean.
        const inner = (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-carbon truncate">{s.name}</p>
              <p className="text-[10px] text-bronceado">
                {s.comunaLabel} · hace {daysSince(s.createdAt)}
              </p>
            </div>
            <SubmissionBadge status={s.moderationStatus} />
          </div>
        );
        return (
          <li key={s.id}>
            {s.moderationStatus === "approved" ? (
              <Link
                href={`/${s.comunaSlug}/${s.slug}`}
                className="block bg-crema-deep border border-crema-edge rounded-lg p-3 hover:border-mostaza/50 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md"
              >
                {inner}
              </Link>
            ) : (
              <div className="bg-crema-deep border border-crema-edge rounded-lg p-3">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SubmissionBadge({ status }: { status: MySubmissionItem["moderationStatus"] }) {
  if (status === "approved") {
    return (
      <span className="text-[9px] font-medium tracking-wider text-lechuga bg-lechuga/10 px-1.5 py-0.5 rounded uppercase shrink-0">
        aprobado
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="text-[9px] font-medium tracking-wider text-tomate bg-tomate/10 px-1.5 py-0.5 rounded uppercase shrink-0">
        rechazado
      </span>
    );
  }
  return (
    <span className="text-[9px] font-medium tracking-wider text-mostaza-deep bg-mostaza/15 px-1.5 py-0.5 rounded uppercase shrink-0">
      en revisión
    </span>
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
