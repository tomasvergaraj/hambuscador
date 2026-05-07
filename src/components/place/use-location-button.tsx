"use client";

import { IconMapPin, IconMapPinFilled } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  GEO_COOKIE_MAX_AGE_S,
  GEO_COOKIE_NAME,
  serializeGeoCookie,
} from "@/lib/geo";

type Props = {
  /** Si ya hay coords seteadas, el botón muestra "actualizar ubicación". */
  hasCoords: boolean;
};

/**
 * Botón opt-in que pide permiso de geolocalización al navegador. En éxito,
 * setea la cookie `hb_geo` y refresca la page para que el servidor reordene
 * los locales por distancia.
 */
export function UseLocationButton({ hasCoords }: Props) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestLocation() {
    setError(null);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("tu navegador no soporta geolocalización");
      return;
    }

    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const value = serializeGeoCookie({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        document.cookie = `${GEO_COOKIE_NAME}=${value}; path=/; max-age=${GEO_COOKIE_MAX_AGE_S}; samesite=lax`;
        setRequesting(false);
        startTransition(() => router.refresh());
      },
      (err) => {
        setRequesting(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "permiso denegado. activa la ubicación en el navegador."
            : "no pudimos obtener tu ubicación, intenta de nuevo.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  const loading = requesting || pending;

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={requestLocation}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-tomate font-medium hover:opacity-80 disabled:opacity-50"
      >
        {hasCoords ? (
          <IconMapPinFilled size={14} aria-hidden="true" />
        ) : (
          <IconMapPin size={14} aria-hidden="true" />
        )}
        {loading
          ? "ubicando…"
          : hasCoords
            ? "actualizar ubicación"
            : "usar mi ubicación"}
      </button>
      {error ? (
        <p role="alert" className="text-[11px] text-tomate mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}
