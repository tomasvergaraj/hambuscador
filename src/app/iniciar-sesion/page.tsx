import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { IniciarSesionForm } from "./iniciar-sesion-form";

export const metadata = {
  title: "iniciar sesión",
  description: "Inicia sesión en Hambuscador.",
};

export default function IniciarSesionPage() {
  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="flex flex-col min-h-screen px-6 py-8">
      <div className="flex justify-end mb-2">
        <Link
          href="/"
          aria-label="cerrar"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-tinta-suave hover:text-carbon"
        >
          ×
        </Link>
      </div>

      <div className="flex flex-col items-center pt-6">
        <Logo variant="icon" size={64} />
      </div>

      <header className="text-center mt-5 mb-8">
        <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight">
          hola de nuevo
        </h1>
        <p className="text-xs text-tinta-suave mt-2">la picá te estaba esperando</p>
      </header>

      <IniciarSesionForm googleEnabled={googleEnabled} />

      <div className="flex-1" />

      <p className="text-center text-xs text-tinta-suave mt-6">
        ¿no tienes cuenta?{" "}
        <Link href="/registro" className="text-carbon font-semibold">
          crear cuenta
        </Link>
      </p>
    </div>
  );
}
