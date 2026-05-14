import { IconExternalLink, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import {
  getBrandById,
  getPlacesForBrand,
  searchPlacesForBrand,
} from "@/server/services/brands";

import {
  bulkAssignPlacesAction,
  deleteBrandAction,
  removePlaceFromBrandAction,
  updateBrandAction,
} from "../actions";
import { BrandForm } from "../brand-form";
import { DeleteBrandButton } from "./delete-button";

export const metadata = { title: "admin · cadena" };
export const dynamic = "force-dynamic";

type Params = { id: string };
type SearchParams = { q?: string };

const STATUS_COLOR: Record<string, string> = {
  approved: "bg-lechuga/20 text-lechuga",
  pending: "bg-mostaza/20 text-mostaza-deep",
  rejected: "bg-tomate/20 text-tomate",
};

export default async function AdminBrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";

  const [brand, brandPlaces, candidates] = await Promise.all([
    getBrandById(id),
    getPlacesForBrand(id),
    // Solo buscar candidatos cuando el admin tipea — sino lista vacía.
    query.length >= 2
      ? searchPlacesForBrand({ brandId: id, query, limit: 50 })
      : Promise.resolve([]),
  ]);
  if (!brand) notFound();

  const boundUpdate = updateBrandAction.bind(null, id);
  const boundDelete = deleteBrandAction.bind(null, id);
  const boundBulkAssign = bulkAssignPlacesAction.bind(null, id);
  const boundRemove = removePlaceFromBrandAction.bind(null, id);

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
          {brand.name}
        </h1>
        <p className="text-[11px] text-bronceado">/{brand.slug}</p>
      </header>

      <BrandForm mode="edit" brand={brand} action={boundUpdate} />

      <section className="mt-6">
        <h2 className="font-display font-semibold text-base text-carbon mb-2">
          locales asignados ({brandPlaces.length})
        </h2>
        {brandPlaces.length === 0 ? (
          <p className="text-xs text-tinta-suave bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5">
            sin locales aún. Busca y agrega abajo, o desde el editor de cada
            local.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {brandPlaces.map((p) => (
              <li
                key={p.id}
                className="bg-white border border-crema-edge rounded-md px-3 py-2 flex items-center gap-2 text-xs"
              >
                <span
                  className={
                    "text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded shrink-0 " +
                    (STATUS_COLOR[p.moderationStatus] ?? "bg-crema-edge")
                  }
                >
                  {p.moderationStatus}
                </span>
                <span className="font-medium text-carbon truncate flex-1">
                  {p.name}
                </span>
                <span className="text-bronceado shrink-0">{p.comunaLabel}</span>
                <Link
                  href={`/admin/places/${p.id}/edit`}
                  className="text-bronceado hover:text-carbon shrink-0"
                  aria-label="editar"
                >
                  <IconExternalLink size={14} />
                </Link>
                <form action={boundRemove}>
                  <input type="hidden" name="placeId" value={p.id} />
                  <button
                    type="submit"
                    aria-label="quitar de la cadena"
                    className="inline-flex items-center justify-center w-6 h-6 text-tomate hover:bg-tomate/10 rounded transition-colors"
                  >
                    <IconX size={12} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display font-semibold text-base text-carbon mb-2">
          agregar locales
        </h2>
        <p className="text-[11px] text-bronceado mb-3 leading-relaxed">
          busca por nombre. Marca los que pertenecen a la cadena y dale
          agregar. Solo aparecen locales aprobados que no están en esta
          cadena (los de otras brands también, pero los reasigna).
        </p>

        <form
          method="get"
          action={`/admin/brands/${id}`}
          className="mb-3"
        >
          <SearchBar
            name="q"
            defaultValue={query}
            placeholder="ej. McDonald's, Burger King"
          />
        </form>

        {query.length < 2 ? (
          <p className="text-xs text-tinta-suave bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5">
            escribe ≥2 caracteres para buscar.
          </p>
        ) : candidates.length === 0 ? (
          <p className="text-xs text-tinta-suave bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5">
            sin candidatos pa &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <form action={boundBulkAssign} className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto bg-white border border-crema-edge rounded-md p-2">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 text-xs hover:bg-crema-deep rounded px-2 py-1.5"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      name="placeIds"
                      value={c.id}
                      className="w-4 h-4 accent-mostaza shrink-0"
                    />
                    <span className="font-medium text-carbon truncate flex-1">
                      {c.name}
                    </span>
                    <span className="text-bronceado shrink-0">
                      {c.comunaLabel}
                    </span>
                  </label>
                  {c.currentBrandId && (
                    <span className="text-[9px] uppercase tracking-wider font-medium bg-tomate/15 text-tomate px-1 py-0.5 rounded shrink-0">
                      reasignar
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-bronceado">
              {candidates.length} candidato{candidates.length === 1 ? "" : "s"}
              {candidates.length === 50 ? " (limit 50, afina la búsqueda)" : ""}
            </p>
            <Button type="submit" variant="primary" size="md" fullWidth>
              <IconPlus size={14} aria-hidden="true" /> agregar seleccionados
            </Button>
          </form>
        )}
      </section>

      <section className="mt-6 bg-tomate/5 border border-tomate/30 rounded-xl p-4">
        <h2 className="font-display font-semibold text-sm text-carbon mb-2">
          <IconTrash size={14} className="inline mr-1" aria-hidden="true" />
          borrar cadena
        </h2>
        <p className="text-xs text-tinta-suave leading-relaxed">
          Los {brandPlaces.length} {brandPlaces.length === 1 ? "local" : "locales"}{" "}
          asociados quedan huérfanos (vuelven al pin default). Las subs a nivel
          brand deben cancelarse antes (cuando se wire el tier).
        </p>
        <DeleteBrandButton brandName={brand.name} action={boundDelete} />
      </section>
    </main>
  );
}
