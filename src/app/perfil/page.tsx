import { IconLogout, IconStar, IconHeart, IconBuildingStore } from "@tabler/icons-react";
import { redirect } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { Button } from "@/components/ui/button";
import { initialsFromName } from "@/lib/utils";
import { auth } from "@/server/auth";
import { getUserStats } from "@/server/services/users";
import { signOutAction } from "./actions";

export const metadata = {
  title: "mi perfil",
};

type SearchParams = { nuevo?: string };

/**
 * Perfil del usuario logueado. Si no hay sesión redirige a `/iniciar-sesion`.
 * Lee `?nuevo=1` (viene del redirect de `/agregar`) para mostrar un banner
 * de confirmación.
 *
 * TODO Fase 3: tabs (favoritos, mis reseñas, mis aportes) leyendo de DB.
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

  const [{ nuevo }, stats] = await Promise.all([searchParams, getUserStats(session.user.id)]);
  const showSubmittedBanner = nuevo === "1";

  const name = session.user.name ?? "tú";
  const email = session.user.email ?? "";
  const initials = initialsFromName(name);

  return (
    <div className="flex flex-col min-h-screen pb-20">
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

        {/* Stats reales — el detalle (listas tabuladas) llega en Fase 3 */}
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
