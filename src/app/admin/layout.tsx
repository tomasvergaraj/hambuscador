import { IconShieldCheck } from "@tabler/icons-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { countPendingClaims } from "@/server/services/claims";
import { countPendingPlaces } from "@/server/services/places";

/**
 * Layout compartido para todas las rutas /admin/*. Guard de rol admin
 * upfront — usuarios sin rol son redirigidos a `/` (no leak de la URL).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }

  // Counts paralelos para badges de los tabs. No-op en modo demo (sin DB).
  const [pendingCount, claimsCount] = await Promise.all([
    countPendingPlaces(),
    countPendingClaims(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-carbon text-crema px-4 py-3 flex items-center gap-2">
        <IconShieldCheck size={18} aria-hidden="true" />
        <Link href="/admin/moderacion" className="font-display font-semibold text-sm">
          admin · hambuscador
        </Link>
        <div className="flex-1" />
        <Link href="/" className="text-[11px] text-crema-edge hover:text-crema">
          ← volver al sitio
        </Link>
      </header>
      <nav
        aria-label="secciones admin"
        className="bg-carbon-soft text-crema-edge border-b border-carbon flex gap-3 px-4"
      >
        <Link
          href="/admin/moderacion"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza inline-flex items-center gap-1.5"
        >
          pendientes
          {pendingCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-mostaza text-carbon text-[10px] font-bold"
              aria-label={`${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`}
            >
              {pendingCount}
            </span>
          )}
        </Link>
        <Link
          href="/admin/places"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza"
        >
          locales
        </Link>
        <Link
          href="/admin/claims"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza inline-flex items-center gap-1.5"
        >
          claims
          {claimsCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-tomate text-crema-deep text-[10px] font-bold"
              aria-label={`${claimsCount} ${claimsCount === 1 ? "claim" : "claims"}`}
            >
              {claimsCount}
            </span>
          )}
        </Link>
        <Link
          href="/admin/resenas"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza"
        >
          reseñas
        </Link>
        <Link
          href="/admin/usuarios"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza"
        >
          usuarios
        </Link>
        <Link
          href="/admin/search"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza"
        >
          búsquedas
        </Link>
        <Link
          href="/admin/perf"
          className="text-xs py-2 hover:text-crema border-b-2 border-transparent hover:border-mostaza"
        >
          perf
        </Link>
      </nav>
      {children}
    </div>
  );
}
