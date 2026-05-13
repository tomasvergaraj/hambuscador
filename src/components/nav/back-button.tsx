"use client";

import { useRouter } from "next/navigation";
import { IconArrowLeft, IconX } from "@tabler/icons-react";

type Props = {
  isModal?: boolean;
};

/**
 * Botón "atrás" que invoca `router.back()` — único motivo por el que el
 * Header necesita JS. Cuando la page pasa `backHref` al Header, este
 * componente NO se monta y la página es 100% server-rendered.
 */
export function BackButton({ isModal }: Props) {
  const router = useRouter();
  const Icon = isModal ? IconX : IconArrowLeft;
  const ariaLabel = isModal ? "Cerrar" : "Volver";
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={ariaLabel}
      className="w-8 h-8 -ml-1 flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90"
    >
      <Icon size={20} stroke={1.75} />
    </button>
  );
}
