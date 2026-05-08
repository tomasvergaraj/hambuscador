import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { getPlaceBySlug } from "@/lib/data";
import { auth } from "@/server/auth";
import { hasPendingClaim, isOwnerOf } from "@/server/services/claims";

import { ClaimForm } from "./claim-form";

export const metadata = { title: "reclamar local" };
export const dynamic = "force-dynamic";

type Params = { comuna: string; slug: string };

export default async function ReclamarPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { comuna, slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/${comuna}/${slug}/reclamar`);
  }

  const place = await getPlaceBySlug(comuna, slug);
  if (!place) notFound();

  // Si ya es owner, no tiene sentido reclamar — redirige al detail.
  if (await isOwnerOf(session.user.id, place.id)) {
    redirect(`/${comuna}/${slug}`);
  }
  const alreadyPending = await hasPendingClaim(place.id, session.user.id);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="reclamar local" backHref={`/${comuna}/${slug}`} />

      <main className="px-4 pt-4 flex-1 flex flex-col gap-4">
        <section className="bg-crema-deep border border-crema-edge rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-bronceado font-medium">
            reclamando
          </p>
          <h1 className="font-display font-semibold text-lg text-carbon mt-1">
            {place.name}
          </h1>
          <p className="text-xs text-tinta-suave mt-0.5">
            {place.comunaLabel}, {place.region}
          </p>
        </section>

        {alreadyPending ? (
          <div className="rounded-xl bg-mostaza/15 border border-mostaza/40 p-4 text-center">
            <p className="font-display font-semibold text-base text-carbon">
              ya tienes una solicitud en revisión
            </p>
            <p className="text-xs text-tinta-suave mt-1.5 leading-relaxed">
              El equipo está revisando tu reclamo de <strong>{place.name}</strong>.
              Te avisamos por email cuando esté.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-tinta-suave leading-relaxed">
              ¿Eres el dueño o representante de <strong>{place.name}</strong>?
              Llena este form y nuestro equipo revisa el reclamo. Una vez
              aprobado, podrás editar la ficha (logo, fotos, horario,
              contacto) directamente.
            </p>

            <ClaimForm
              comuna={comuna}
              slug={slug}
              placeName={place.name}
              defaultEmail={session.user.email ?? ""}
            />
          </>
        )}
      </main>
    </div>
  );
}
