import { IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPlaceByIdForAdmin } from "@/server/services/places";

import { EditPlaceForm } from "./edit-form";

export const metadata = { title: "admin · editar local" };
export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function AdminEditPlacePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const place = await getPlaceByIdForAdmin(id);
  if (!place) notFound();

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href="/admin/places"
            className="text-xs text-tinta-suave hover:text-carbon"
          >
            ← volver al listado
          </Link>
          <h1 className="font-display font-semibold text-xl text-carbon mt-1 truncate">
            editar: {place.name}
          </h1>
          <p className="text-[11px] text-bronceado mt-0.5">
            /{place.comuna}/{place.slug} · estado:{" "}
            <span className="font-medium text-carbon">
              {place.isVerified ? "verificado · " : ""}
              {/* moderationStatus viene en el row pero no se expone en Place;
                  lo mostramos solo si está en el getAllPlaces shape. Acá no
                  lo tenemos, así que omitimos para simplificar. */}
            </span>
          </p>
        </div>
        <Link
          href={`/${place.comuna}/${place.slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs text-carbon bg-crema-deep border border-crema-edge hover:bg-white px-3 py-1.5 rounded-full transition-colors"
        >
          <IconExternalLink size={14} />
          ver ficha
        </Link>
      </div>

      <EditPlaceForm place={place} />
    </main>
  );
}
