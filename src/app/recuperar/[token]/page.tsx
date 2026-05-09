import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { verifyResetToken } from "@/server/services/password-reset";
import { ResetForm } from "./reset-form";

export const metadata = {
  title: "crear nueva contraseña",
  robots: { index: false, follow: false },
};

export default async function ResetTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await verifyResetToken(token);

  return (
    <div className="flex flex-col px-6 pt-4 pb-8">
      <div className="flex justify-end">
        <Link
          href="/iniciar-sesion"
          aria-label="cerrar"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-tinta-suave hover:text-carbon"
        >
          ×
        </Link>
      </div>

      <div className="flex flex-col items-center mt-1">
        <Logo variant="icon" size={56} />
      </div>

      {user ? (
        <>
          <header className="text-center mt-3 mb-5">
            <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight">
              nueva contraseña
            </h1>
            <p className="text-xs text-tinta-suave mt-2">
              para <span className="text-carbon font-medium">{user.email}</span>
            </p>
          </header>

          <ResetForm token={token} email={user.email} />
        </>
      ) : (
        <>
          <header className="text-center mt-3 mb-5">
            <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight">
              link inválido
            </h1>
            <p className="text-xs text-tinta-suave mt-2 px-4">
              el link expiró o ya fue usado. pide uno nuevo abajo
            </p>
          </header>

          <Link
            href="/recuperar"
            className="block text-center bg-mostaza text-carbon font-display font-semibold text-sm rounded-md py-3 transition-transform active:scale-95"
          >
            pedir nuevo link
          </Link>
        </>
      )}

      <p className="text-center text-xs text-tinta-suave mt-5">
        <Link href="/iniciar-sesion" className="text-carbon font-semibold">
          volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
