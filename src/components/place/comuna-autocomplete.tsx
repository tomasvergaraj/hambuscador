"use client";

import * as React from "react";
import { IconMapPin, IconSearch } from "@tabler/icons-react";

import { normalizeForSearch } from "@/lib/search";
import type { Comuna } from "@/server/services/comunas";
import { cn } from "@/lib/utils";

/**
 * Autocomplete sobre las 346 comunas de Chile. La lista entera (~28KB) se
 * pasa como prop desde el server (`getAllComunas()`), así filtramos cliente
 * sin round-trips. Cuando el catálogo justifique mover a server-search,
 * cambiar `filter` por una server action debounced.
 *
 * Selección dispara `onChange(comuna)` con el objeto entero — el wizard usa
 * el centroide para sesgar el geocoding y `regionLabel` para el INSERT.
 */

type Props = {
  comunas: Comuna[];
  value: Comuna | null;
  onChange: (comuna: Comuna | null) => void;
  placeholder?: string;
};

const LISTBOX_ID = "comuna-autocomplete-listbox";

export function ComunaAutocomplete({
  comunas,
  value,
  onChange,
  placeholder = "busca tu comuna...",
}: Props) {
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Sincronizamos query con value cuando viene desde fuera (ej. reset).
  React.useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

  const matches = React.useMemo<Comuna[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Sin query: mostramos las 50 primeras alfabéticamente — sirve como
      // "browse" si el user no sabe qué buscar.
      return comunas.slice(0, 50);
    }
    const norm = normalizeForSearch(trimmed);
    return comunas
      .filter((c) => normalizeForSearch(c.label).includes(norm))
      .slice(0, 20);
  }, [comunas, query]);

  React.useEffect(() => {
    setActive(-1);
  }, [matches]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showDropdown = open && matches.length > 0;

  const pick = (c: Comuna) => {
    onChange(c);
    setQuery(c.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => (p + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => (p - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      const picked = active >= 0 ? matches[active] : undefined;
      if (picked) {
        e.preventDefault();
        pick(picked);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <IconSearch
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-bronceado pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // Si el user está editando y ya tenía una selección, la limpiamos
            // hasta que vuelva a elegir.
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={
            active >= 0 ? `${LISTBOX_ID}-opt-${active}` : undefined
          }
          className="w-full bg-crema-deep border border-crema-edge rounded-md pl-9 pr-3 py-2.5 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado"
        />
      </div>

      {showDropdown && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-crema-edge shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {matches.map((c, idx) => (
            <button
              key={c.slug}
              id={`${LISTBOX_ID}-opt-${idx}`}
              type="button"
              role="option"
              aria-selected={active === idx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              onMouseEnter={() => setActive(idx)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                active === idx
                  ? "bg-crema-deep"
                  : "bg-white hover:bg-crema-deep/60",
              )}
            >
              <span className="w-7 h-7 rounded-lg bg-crema-deep inline-flex items-center justify-center text-bronceado shrink-0">
                <IconMapPin size={14} stroke={1.75} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-carbon truncate">
                  {c.label}
                </span>
                <span className="block text-[11px] text-tinta-suave truncate">
                  {c.regionLabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
