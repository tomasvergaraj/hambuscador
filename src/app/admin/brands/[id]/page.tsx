import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBrandById, getPlacesForBrand } from "@/server/services/brands";

import { deleteBrandAction, updateBrandAction } from "../actions";
import { BrandForm } from "../brand-form";
import { DeleteBrandButton } from "./delete-button";

export const metadata = { title: "admin · cadena" };
export const dynamic = "force-dynamic";

type Params = { id: string };

const STATUS_COLOR: Record<string, string> = {
  approved: "bg-lechuga/20 text-lechuga",
  pending: "bg-mostaza/20 text-mostaza-deep",
  rejected: "bg-tomate/20 text-tomate",
};

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const [brand, brandPlaces] = await Promise.all([
    getBrandById(id),
    getPlacesForBrand(id),
  ]);
  if (!brand) notFound();

  const boundUpdate = updateBrandAction.bind(null, id);
  const boundDelete = deleteBrandAction.bind(null, id);

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
            asigna locales desde <code>/admin/places/[id]/edit</code> usando
            el selector de cadena.
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
              </li>
            ))}
          </ul>
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
