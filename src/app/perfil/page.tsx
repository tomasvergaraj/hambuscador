import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";

export const metadata = {
  title: "mi perfil",
};

/**
 * TODO Fase 3: perfil propio con tabs (favoritos, mis reseñas, mis aportes).
 * Para usuarios no autenticados, redirigir a /iniciar-sesion.
 */
export default function PerfilPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="mi perfil" />

      <main className="px-4 pt-6 flex-1">
        <div className="rounded-xl bg-crema-deep border border-crema-edge p-6 text-center">
          <p className="font-display font-semibold text-base text-carbon">próximamente</p>
          <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
            avatar, estadísticas, favoritos, mis reseñas. Por implementar en Fase 3.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
