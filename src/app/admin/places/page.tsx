import { IconEdit, IconExternalLink, IconPhoto } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import { SearchBar } from "@/components/ui/search-bar";
import { getAllPlacesForAdmin } from "@/server/services/places";

export const metadata = { title: "admin · locales" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; estado?: "approved" | "pending" | "rejected" };

const STATUS_LABEL: Record<string, string> = {
  approved: "aprobado",
  pending: "pendiente",
  rejected: "rechazado",
};

const STATUS_COLOR: Record<string, string> = {
  approved: "bg-lechuga/20 text-lechuga",
  pending: "bg-mostaza/20 text-mostaza-deep",
  rejected: "bg-tomate/20 text-tomate",
};

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const places = await getAllPlacesForAdmin({
    query: sp.q?.trim() || undefined,
    status: sp.estado,
    limit: 100,
  });

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display font-semibold text-xl text-carbon">locales</h1>
        <span className="text-xs text-tinta-suave">
          {places.length} {places.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      <form action="/admin/places" method="get" className="mb-3">
        <SearchBar
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="buscar por nombre o comuna"
        />
        {sp.estado ? <input type="hidden" name="estado" value={sp.estado} /> : null}
      </form>

      <nav className="flex gap-2 mb-4 text-xs">
        <StatusFilter current={sp.estado} value={undefined} q={sp.q}>
          todos
        </StatusFilter>
        <StatusFilter current={sp.estado} value="approved" q={sp.q}>
          aprobados
        </StatusFilter>
        <StatusFilter current={sp.estado} value="pending" q={sp.q}>
          pendientes
        </StatusFilter>
        <StatusFilter current={sp.estado} value="rejected" q={sp.q}>
          rechazados
        </StatusFilter>
      </nav>

      {places.length === 0 ? (
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            sin resultados
          </p>
          <p className="text-xs text-tinta-suave mt-2">
            ajusta los filtros o la búsqueda
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {places.map((place) => {
            // Thumb: logo > primera foto > placeholder. object-contain con
            // padding para logos (no recortar wordmark); cover para fotos.
            const thumb = place.logo ?? place.photos[0];
            const isLogo = Boolean(place.logo);
            return (
            <li
              key={place.id}
              className="bg-white border border-crema-edge rounded-xl p-3 flex items-center gap-3"
            >
              <div className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden bg-mostaza-deep flex items-center justify-center border border-crema-edge">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={place.name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <IconPhoto
                    size={16}
                    stroke={1.5}
                    className="text-crema-deep opacity-60"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-semibold text-sm text-carbon truncate">
                    {place.name}
                  </h2>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                      STATUS_COLOR[place.moderationStatus] ?? "bg-crema-edge text-tinta-suave"
                    }`}
                  >
                    {STATUS_LABEL[place.moderationStatus] ?? place.moderationStatus}
                  </span>
                  {place.isVerified && (
                    <span className="text-[10px] uppercase tracking-wider font-medium bg-lechuga/20 text-lechuga px-1.5 py-0.5 rounded">
                      verificado
                    </span>
                  )}
                  {place.isFeatured && (
                    <span className="text-[10px] uppercase tracking-wider font-medium bg-tomate/15 text-tomate px-1.5 py-0.5 rounded">
                      destacado
                    </span>
                  )}
                  {isLogo && (
                    <span className="text-[10px] uppercase tracking-wider font-medium bg-mostaza/20 text-mostaza-deep px-1.5 py-0.5 rounded">
                      logo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-bronceado mt-0.5 truncate">
                  {place.comunaLabel} · {place.priceRange} ·{" "}
                  {place.cuisines.slice(0, 3).join(", ")}
                </p>
              </div>
              <Link
                href={`/${place.comuna}/${place.slug}`}
                target="_blank"
                rel="noopener"
                aria-label="ver ficha pública"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-bronceado hover:bg-crema-deep hover:text-carbon transition-colors"
              >
                <IconExternalLink size={16} />
              </Link>
              <Link
                href={`/admin/places/${place.id}/edit`}
                aria-label="editar"
                className="inline-flex items-center gap-1 text-xs font-medium text-carbon bg-mostaza hover:bg-mostaza-deep px-3 py-1.5 rounded-full transition-[transform,colors] active:scale-95"
              >
                <IconEdit size={14} />
                editar
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function StatusFilter({
  current,
  value,
  q,
  children,
}: {
  current: string | undefined;
  value: "approved" | "pending" | "rejected" | undefined;
  q: string | undefined;
  children: React.ReactNode;
}) {
  const active = current === value;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value) params.set("estado", value);
  const qs = params.toString();
  return (
    <Link
      href={qs ? `/admin/places?${qs}` : "/admin/places"}
      className={`px-3 py-1 rounded-full transition-colors ${
        active
          ? "bg-carbon text-crema font-medium"
          : "text-tinta-suave hover:bg-crema-deep"
      }`}
    >
      {children}
    </Link>
  );
}
