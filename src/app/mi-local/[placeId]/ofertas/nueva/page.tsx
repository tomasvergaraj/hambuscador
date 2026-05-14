import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import { getPlaceByIdForAdmin } from "@/server/services/places";
import { hasActiveTier } from "@/server/services/subscriptions";

import { ownerCreatePromotionAction } from "../actions";
import { PromoForm } from "@/app/admin/ofertas/promo-form";

export const metadata = { title: "nueva oferta" };
export const dynamic = "force-dynamic";

type Params = { placeId: string };

export default async function NuevaOfertaOwnerPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { placeId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/mi-local/${placeId}/ofertas/nueva`);
  }
  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const place = await getPlaceByIdForAdmin(placeId);
  if (!place) notFound();

  const [hasPromo, hasPremium] = await Promise.all([
    hasActiveTier(placeId, "promo"),
    hasActiveTier(placeId, "premium"),
  ]);
  if (!hasPromo && !hasPremium) {
    redirect(`/mi-local/${placeId}/ofertas`);
  }

  const bound = ownerCreatePromotionAction.bind(null, placeId);

  return (
    <div className="flex flex-col min-h-screen pb-12">
      <Header title="nueva oferta" backHref={`/mi-local/${placeId}/ofertas`} />

      <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
        <p className="text-xs text-tinta-suave mb-4 leading-relaxed">
          la oferta queda en revisión hasta que un admin la apruebe. Después
          aparece en el carousel del home (de tu región) y en la ficha del
          local.{" "}
          <Link
            href={`/mi-local/${placeId}/ofertas`}
            className="text-mostaza-deep underline"
          >
            ver mis ofertas
          </Link>
        </p>

        <PromoForm mode="create" action={bound} defaultPlaceId={placeId} />
      </main>
    </div>
  );
}
