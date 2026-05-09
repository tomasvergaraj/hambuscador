import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { RecuperarForm } from "./recuperar-form";

export const metadata = {
  title: "recuperar contraseña",
  description: "Recibe un link por email para crear una nueva contraseña.",
};

export default function RecuperarPage() {
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

      <header className="text-center mt-3 mb-5">
        <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight">
          recuperar contraseña
        </h1>
        <p className="text-xs text-tinta-suave mt-2 px-4">
          ingresa tu email y te mandamos un link para crear una nueva
        </p>
      </header>

      <RecuperarForm />

      <p className="text-center text-xs text-tinta-suave mt-5">
        ¿la recordaste?{" "}
        <Link href="/iniciar-sesion" className="text-carbon font-semibold">
          iniciar sesión
        </Link>
      </p>
    </div>
  );
}
