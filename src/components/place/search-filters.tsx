"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  IconClockHour4,
  IconAdjustmentsHorizontal,
  IconSortDescending,
  IconCheck,
} from "@tabler/icons-react";

import { Chip } from "@/components/ui/chip";
import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SortKey = "rating" | "recent" | "distance";

const SORT_LABELS: Record<SortKey, string> = {
  rating: "mejor calificadas",
  recent: "más recientes",
  distance: "más cercanas",
};

export type SearchFiltersProps = {
  /** Si el usuario ya autorizó geolocalización (cookie hb_geo presente). */
  hasUserCoords: boolean;
  /** Total de resultados — para rótulo arriba a la izquierda. */
  resultsCount: number;
  /**
   * Si true, las chips se extienden edge-to-edge con `-mx-4 px-4` (vista lista).
   * Si false, respetan el padding del contenedor (vista mapa, dentro de card).
   * Default: true.
   */
  bleed?: boolean;
  /** Oculta la línea inferior con conteo + sort (útil cuando va dentro de un card chico). */
  hideMeta?: boolean;
  className?: string;
};

/**
 * Barra de filtros de /buscar. Toda la lógica de URL viene de useSearchParams;
 * cada toggle calcula la nueva URL y hace router.push (scroll: false) — la
 * page es server, así que se reejecuta con los nuevos params.
 *
 * Convenciones de URL:
 * - `cocina=smash,artesanal` (csv)
 * - `precio=$,$$` (csv)
 * - `abierto=1`
 * - `orden=rating|recent|distance` (omitido = rating)
 */
export function SearchFilters({
  hasUserCoords,
  resultsCount,
  bleed = true,
  hideMeta = false,
  className,
}: SearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const cuisines = parseCsv(sp.get("cocina"));
  const prices = parseCsv(sp.get("precio"));
  const openNow = sp.get("abierto") === "1";
  // Default dinámico: si hay coords, distance; sino, rating. Coincide con el
  // server (page.tsx). El user puede pisar con `orden=...` en la URL.
  const explicitSort = sp.get("orden") as SortKey | null;
  const sort: SortKey = explicitSort ?? (hasUserCoords ? "distance" : "rating");

  const activeCount = cuisines.length + prices.length + (openNow ? 1 : 0);

  const buildHref = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(sp.toString());
      mutate(next);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, sp],
  );

  const toggleListParam = (key: string, value: string) => {
    const href = buildHref((p) => {
      const current = parseCsv(p.get(key));
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (next.length === 0) p.delete(key);
      else p.set(key, next.join(","));
    });
    router.push(href, { scroll: false });
  };

  const toggleOpen = () => {
    const href = buildHref((p) => {
      if (openNow) p.delete("abierto");
      else p.set("abierto", "1");
    });
    router.push(href, { scroll: false });
  };

  const setSort = (key: SortKey) => {
    const href = buildHref((p) => {
      // Si la elección coincide con el default actual, omitimos `orden` de la URL.
      const currentDefault: SortKey = hasUserCoords ? "distance" : "rating";
      if (key === currentDefault) p.delete("orden");
      else p.set("orden", key);
    });
    router.push(href, { scroll: false });
  };

  const clearAll = () => {
    const href = buildHref((p) => {
      p.delete("cocina");
      p.delete("precio");
      p.delete("abierto");
      p.delete("orden");
    });
    router.push(href, { scroll: false });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Strip de chips: scroll horizontal, mobile-first */}
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto scrollbar-hide",
          bleed && "-mx-4 px-4",
        )}
      >
        <Chip
          active={openNow}
          onClick={toggleOpen}
          aria-pressed={openNow}
          className={cn(openNow ? "" : "gap-1")}
        >
          {!openNow && <IconClockHour4 size={12} stroke={2} aria-hidden="true" />}
          abierto
        </Chip>

        {PRICE_RANGES.map((p) => (
          <Chip
            key={p.id}
            active={prices.includes(p.id)}
            onClick={() => toggleListParam("precio", p.id)}
            aria-pressed={prices.includes(p.id)}
          >
            {p.label}
          </Chip>
        ))}

        <span className="w-px h-5 bg-crema-edge shrink-0" aria-hidden="true" />

        {CUISINE_TYPES.map((c) => (
          <Chip
            key={c.id}
            active={cuisines.includes(c.id)}
            onClick={() => toggleListParam("cocina", c.id)}
            aria-pressed={cuisines.includes(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {/* Línea de info + sort + clear */}
      {!hideMeta && (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-carbon font-medium inline-flex items-center gap-2">
          {resultsCount} {resultsCount === 1 ? "resultado" : "resultados"}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-tinta-suave hover:text-carbon underline underline-offset-2 transition-colors"
            >
              <IconAdjustmentsHorizontal size={12} stroke={2} aria-hidden="true" />
              limpiar ({activeCount})
            </button>
          )}
        </span>

        <SortMenu
          value={sort}
          onChange={setSort}
          allowDistance={hasUserCoords}
        />
      </div>
      )}
    </div>
  );
}

type SortMenuProps = {
  value: SortKey;
  onChange: (k: SortKey) => void;
  allowDistance: boolean;
};

function SortMenu({ value, onChange, allowDistance }: SortMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const options: Array<{ key: SortKey; label: string; disabled?: boolean }> = [
    { key: "rating", label: SORT_LABELS.rating },
    { key: "distance", label: SORT_LABELS.distance, disabled: !allowDistance },
    { key: "recent", label: SORT_LABELS.recent },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-xs text-tinta-suave hover:text-carbon inline-flex items-center gap-1 transition-colors"
      >
        <IconSortDescending size={12} stroke={2} aria-hidden="true" />
        {SORT_LABELS[value]} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] bg-white border border-crema-edge rounded-lg shadow-lg overflow-hidden"
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={value === o.key}
              disabled={o.disabled}
              onClick={() => {
                if (o.disabled) return;
                onChange(o.key);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left text-xs px-3 py-2 inline-flex items-center justify-between gap-2 transition-colors",
                o.disabled
                  ? "text-bronceado cursor-not-allowed"
                  : value === o.key
                    ? "bg-crema-deep text-carbon font-medium"
                    : "text-carbon hover:bg-crema-deep",
              )}
            >
              <span>{o.label}</span>
              {value === o.key && <IconCheck size={12} stroke={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
