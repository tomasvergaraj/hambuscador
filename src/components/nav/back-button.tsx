"use client";

import { useRouter } from "next/navigation";
import { IconArrowLeft, IconX } from "@tabler/icons-react";

type Props = {
  isModal?: boolean;
  /**
   * Ruta a la que ir si NO hay página anterior en el historial del tab
   * (ej. el user llegó por deeplink, share, push notification, abrir en
   * pestaña nueva). Sin este fallback, `router.back()` en una entrada
   * directa cierra la tab o navega fuera del sitio.
   */
  fallbackHref?: string;
};

/**
 * Botón "atrás" con preferencia por la navegación real del user.
 *
 * Decisión en click:
 * 1. Si el tab tiene historial previo (`window.history.length > 1`),
 *    `router.back()` — vuelve a la última página visitada, incluyendo
 *    rutas que la página actual no podría adivinar (ej. /admin/places →
 *    edit place → back vuelve a /admin/places sin que esa ruta esté
 *    hardcoded acá).
 * 2. Si NO hay historial (entrada directa, deeplink, share), navega al
 *    `fallbackHref` para no dejar al user encerrado.
 *
 * Heurística simple basada en `history.length`: confiable para SPA
 * navegaciones (Next push/replace incrementa la length). False positivo
 * solo cuando el tab abrió esta página después de N redirects sin que el
 * usuario haya navegado — caso raro y benigno (cae a router.back que
 * funciona).
 */
export function BackButton({ isModal, fallbackHref }: Props) {
  const router = useRouter();
  const Icon = isModal ? IconX : IconArrowLeft;
  const ariaLabel = isModal ? "Cerrar" : "Volver";

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref ?? "/");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className="w-8 h-8 -ml-1 flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90"
    >
      <Icon size={20} stroke={1.75} />
    </button>
  );
}
