import { IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import { getPlaceByIdForAdmin } from "@/server/services/places";

import { OwnerEditForm } from "./owner-edit-form";

export const metadata = { title: "editar mi local" };
export const dynamic = "force-dynamic";

type Params = { placeId: string };

/**
 * Editor de un local para su owner verificado. Permisos:
 *  - Owner (places.claimed_by === user.id)
 *  - Admin (full power vía /admin/places/[id]/edit, esta ruta también
 *    funciona para admin pero con campos restringidos).
 *
 * Sino → redirect a la home.
 *
 * Campos editables: cuisines, priceRange, specialty, hoursByDay,
 * phone, whatsapp, instagram, website, logo, photos. NO toca
 * name/slug/comuna/lat/lng/isVerified/isFeatured (rompería URLs/SEO/
 * geo o son flags de admin).
 */
export default async function MiLocalEditarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { placeId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/mi-local/${placeId}/editar`);
  }

  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const place = await getPlaceByIdForAdmin(placeId);
  if (!place) notFound();

  return (
    <div className="flex flex-col min-h-screen pb-12">
      <Header
        title="editar mi local"
        backHref={`/${place.comuna}/${place.slug}`}
      />

      <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-xl text-carbon truncate">
              {place.name}
            </h1>
            <p className="text-[11px] text-bronceado mt-0.5">
              {place.comunaLabel} · {place.region}
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

        <p className="text-[11px] text-bronceado mb-4 leading-relaxed">
          Estos cambios se publican directo, sin pasar por moderación. Para
          cambiar el nombre, comuna o ubicación del local, contacta al equipo.
        </p>

        <OwnerEditForm place={place} />
      </main>
    </div>
  );
}
