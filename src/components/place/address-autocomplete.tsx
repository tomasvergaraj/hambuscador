"use client";

import { IconMapPinFilled } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

// ============================================================================
// AddressAutocomplete — input con sugerencias de Nominatim (OSM, sin API key).
// ----------------------------------------------------------------------------
// Política de Nominatim: 1 req/seg, requiere User-Agent. El navegador no
// permite setear User-Agent custom, así que dependemos de no abusar (debounce
// + min 4 chars). Si en producción necesitamos más volumen → migrar a un
// provider con plan (Photon, Mapbox).
//
// Sesgo geográfico: countrycodes=cl + viewbox por comuna seleccionada.
// ============================================================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  type: string;
};

type Props = {
  value: string;
  onChange: (text: string) => void;
  onSelectLocation: (lat: number, lng: number, displayAddress: string) => void;
  /** Comuna seleccionada. Sesga el bounding box hacia esa zona. */
  bias?: { lat: number; lng: number };
  placeholder?: string;
  className?: string;
};

export function AddressAutocomplete({
  value,
  onChange,
  onSelectLocation,
  bias,
  placeholder,
  className,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce + fetch
  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setError(null);
      setSearched(false);
      setOpen(false);
      return;
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          format: "json",
          countrycodes: "cl",
          limit: "8",
          "accept-language": "es",
          addressdetails: "0",
        });
        if (bias) {
          // Viewbox ~10km alrededor del centroide de la comuna como sesgo
          // (sin `bounded=1` para no descartar resultados afuera).
          const dLat = 0.09;
          const dLng = 0.11;
          params.set(
            "viewbox",
            `${bias.lng - dLng},${bias.lat + dLat},${bias.lng + dLng},${bias.lat - dLat}`,
          );
        }
        const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("nominatim error");
        const data = (await res.json()) as Suggestion[];
        setSuggestions(data);
        setSearched(true);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("no pudimos buscar la dirección, revisa tu conexión");
        setSuggestions([]);
        setSearched(true);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, [value, bias]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(s: Suggestion) {
    const lat = Number(s.lat);
    const lng = Number(s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // Quitamos la cola "Chile" del display_name para mostrar algo más limpio
    const clean = s.display_name.replace(/, Chile$/, "");
    onChange(clean);
    onSelectLocation(lat, lng, clean);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado"
      />
      {loading ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-bronceado">
          buscando…
        </span>
      ) : null}
      {error ? (
        <p className="text-[10px] text-tomate mt-0.5">{error}</p>
      ) : null}
      {open ? (
        <div
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 bg-crema-deep border border-crema-edge rounded-md shadow-md max-h-60 overflow-auto"
        >
          {suggestions.length > 0 ? (
            <ul>
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-crema-edge text-xs text-carbon"
                  >
                    <IconMapPinFilled
                      size={14}
                      className="text-bronceado shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="leading-snug">
                      {s.display_name.replace(/, Chile$/, "")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : searched && !loading ? (
            <p className="px-3 py-2.5 text-xs text-tinta-suave">
              sin resultados. prueba con otra dirección.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
