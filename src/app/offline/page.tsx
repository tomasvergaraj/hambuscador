import { IconWifiOff } from "@tabler/icons-react";
import Link from "next/link";

export const metadata = {
  title: "sin conexión",
};

// Página servida por el service worker como fallback cuando una navegación
// no puede llegar al network y tampoco está en cache. Mantiene la marca y
// permite reintentar.
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-crema">
      <div className="w-16 h-16 rounded-2xl bg-tomate/10 flex items-center justify-center mb-4">
        <IconWifiOff size={28} className="text-tomate" aria-hidden="true" />
      </div>
      <h1 className="font-display font-semibold text-2xl text-carbon">
        sin conexión
      </h1>
      <p className="text-sm text-tinta-suave mt-2 max-w-sm leading-relaxed">
        no pudimos cargar la página. revisa tu wifi o datos móviles e
        inténtalo de nuevo.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center mt-5 bg-mostaza text-carbon font-display font-semibold text-sm px-4 py-2.5 rounded-lg active:scale-[0.97] transition-transform"
      >
        reintentar
      </Link>
    </div>
  );
}
