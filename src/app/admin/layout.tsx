import { IconShieldCheck } from "@tabler/icons-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";

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
      {children}
    </div>
  );
}
