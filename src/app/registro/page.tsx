import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { RegistroForm } from "./registro-form";

export const metadata = {
  title: "crear cuenta",
  description: "Únete a Hambuscador y descubre las mejores hamburgueserías de Chile.",
};

export default function RegistroPage() {
  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="flex flex-col min-h-screen px-6 py-6">
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/iniciar-sesion"
          aria-label="atrás"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-carbon"
        >
          <IconArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="w-9" />
      </div>

      <div className="flex flex-col items-center pt-2">
        <Logo variant="icon" size={56} />
      </div>

      <header className="text-center mt-3 mb-5">
        <h1 className="font-display font-semibold text-xl text-carbon tracking-tight">
          crea tu cuenta
        </h1>
        <p className="text-xs text-tinta-suave mt-1">únete a la picá más grande de Chile</p>
      </header>

      <RegistroForm googleEnabled={googleEnabled} />

      <div className="flex-1" />

      <p className="text-center text-xs text-tinta-suave mt-6">
        ¿ya tienes cuenta?{" "}
        <Link href="/iniciar-sesion" className="text-carbon font-semibold">
          iniciar sesión
        </Link>
      </p>
    </div>
  );
}
