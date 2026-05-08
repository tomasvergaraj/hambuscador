"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconMapPin,
  IconRosetteDiscountCheckFilled,
  IconSearch,
  IconStarFilled,
  IconUser,
  IconWorld,
} from "@tabler/icons-react";

import { PicaIcon } from "@/components/place/pica-icon";
import { SearchBar, type SearchBarProps } from "@/components/ui/search-bar";
import {
  useSearchSuggestions,
  type ComunaSuggestion,
  type PicaSuggestion,
  type PlaceSuggestion,
  type RegionSuggestion,
  type UserSuggestion,
} from "@/lib/use-search-suggestions";
import { cn } from "@/lib/utils";

/**
 * Search del mapa: combina filtrado live (push de `?q=…`) con dropdown de
 * sugerencias. La diferencia con HomeSearchInput es la acción al click:
 *
 * - Place → vuela el mapa al pin (NO navega a la ficha) — el usuario sigue
 *   explorando geográficamente.
 * - Comuna → vuela al centroide de la comuna.
 * - Región → vuela al centroide de la región (zoom más amplio).
 * - Picá → navega a `/picas/[slug]` (única acción que abandona el mapa).
 *
 * La coordinación con `<PlacesMap>` es vía window CustomEvent
 * `hambuscador:flyTo` para evitar acoplar el input al ref del mapa
 * (el mapa vive en otro subtree y maneja su propia instancia maplibre).
 */

export type FlyToDetail = {
  lat: number;
  lng: number;
  zoom: number;
};

export const FLY_TO_EVENT = "hambuscador:flyTo";

function dispatchFlyTo(detail: FlyToDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<FlyToDetail>(FLY_TO_EVENT, { detail }),
  );
}

const LISTBOX_ID = "map-search-listbox";

type Props = Omit<
  SearchBarProps,
  "value" | "defaultValue" | "onValueChange" | "onClear"
> & {
  initialValue: string;
};

export function MapSearchInput({ initialValue, ...rest }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [value, setValue] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [isPending, startTransition] = React.useTransition();

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = React.useRef(initialValue);

  const suggestions = useSearchSuggestions(value);

  // Sync desde URL (back/forward) — mismo patrón que LiveSearchInput.
  const urlQ = sp.get("q") ?? "";
  React.useEffect(() => {
    if (urlQ !== lastPushedRef.current) {
      setValue(urlQ);
      lastPushedRef.current = urlQ;
    }
  }, [urlQ]);

  // Push de filtro live al URL (debounced 200ms) — los pins se filtran al tipear.
  const pushFilter = React.useCallback(
    (q: string) => {
      const next = new URLSearchParams(sp.toString());
      const trimmed = q.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      lastPushedRef.current = trimmed;
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [pathname, router, sp],
  );

  const onValueChange = (v: string) => {
    setValue(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushFilter(v), 200);
  };

  const onClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    setOpen(false);
    pushFilter("");
  };

  // Lista plana para keyboard nav: places → regions → comunas → picas.
  // Regions arriba de comunas porque son matches más amplios (sugerencia
  // jerárquica: lo grande primero).
  type Item =
    | { kind: "place"; data: PlaceSuggestion }
    | { kind: "region"; data: RegionSuggestion }
    | { kind: "comuna"; data: ComunaSuggestion }
    | { kind: "pica"; data: PicaSuggestion }
    | { kind: "user"; data: UserSuggestion };
  const items = React.useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const p of suggestions.places) list.push({ kind: "place", data: p });
    for (const r of suggestions.regions) list.push({ kind: "region", data: r });
    for (const c of suggestions.comunas) list.push({ kind: "comuna", data: c });
    for (const p of suggestions.picas) list.push({ kind: "pica", data: p });
    for (const u of suggestions.users) list.push({ kind: "user", data: u });
    return list;
  }, [suggestions]);

  React.useEffect(() => {
    setActive(-1);
  }, [items]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const totalItems = items.length;
  const showDropdown = open && value.trim().length >= 2 && totalItems > 0;

  const pickItem = (item: Item) => {
    setOpen(false);
    switch (item.kind) {
      case "place":
        dispatchFlyTo({ lat: item.data.lat, lng: item.data.lng, zoom: 16 });
        return;
      case "region":
        dispatchFlyTo({
          lat: item.data.lat,
          lng: item.data.lng,
          zoom: item.data.zoom,
        });
        return;
      case "comuna":
        dispatchFlyTo({ lat: item.data.lat, lng: item.data.lng, zoom: 13 });
        return;
      case "pica":
        router.push(`/picas/${item.data.slug}`);
        return;
      case "user":
        router.push(`/u/${item.data.username}`);
        return;
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushFilter(value);
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
      setActive((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      const picked = active >= 0 ? items[active] : undefined;
      if (picked) {
        e.preventDefault();
        pickItem(picked);
      }
    }
  };

  let cursor = 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={submitForm} role="search">
        <SearchBar
          {...rest}
          value={value}
          onValueChange={onValueChange}
          onClear={onClear}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={
            active >= 0 ? `${LISTBOX_ID}-opt-${active}` : undefined
          }
        />
        {isPending && (
          <span
            aria-hidden="true"
            className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-mostaza border-t-transparent animate-spin"
          />
        )}
      </form>

      {showDropdown && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-crema-edge shadow-lg overflow-hidden max-h-[60vh] overflow-y-auto"
        >
          {suggestions.places.length > 0 && (
            <SectionHeader>locales</SectionHeader>
          )}
          {suggestions.places.map((p) => {
            const idx = cursor++;
            return (
              <Option
                key={`place-${p.id}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => pickItem({ kind: "place", data: p })}
                onMouseEnter={() => setActive(idx)}
              >
                <span className="w-8 h-8 rounded-lg bg-crema-deep inline-flex items-center justify-center text-mostaza shrink-0">
                  <IconSearch size={16} stroke={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1 text-sm font-medium text-carbon">
                    <span className="truncate">{p.name}</span>
                    {p.isVerified && (
                      <IconRosetteDiscountCheckFilled
                        size={14}
                        className="text-mostaza shrink-0"
                        aria-label="verificado"
                      />
                    )}
                  </span>
                  <span className="block text-[11px] text-tinta-suave truncate">
                    {p.comunaLabel}
                    {p.reviewCount > 0 && (
                      <>
                        <span className="mx-1">·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <IconStarFilled
                            size={10}
                            className="text-mostaza"
                            aria-hidden="true"
                          />
                          {p.rating.toFixed(1)}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </Option>
            );
          })}

          {suggestions.regions.length > 0 && (
            <SectionHeader>regiones</SectionHeader>
          )}
          {suggestions.regions.map((r) => {
            const idx = cursor++;
            return (
              <Option
                key={`region-${r.slug}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => pickItem({ kind: "region", data: r })}
                onMouseEnter={() => setActive(idx)}
              >
                <span className="w-8 h-8 rounded-lg bg-crema-deep inline-flex items-center justify-center text-bronceado shrink-0">
                  <IconWorld size={16} stroke={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-carbon truncate">
                    {r.label}
                  </span>
                  <span className="block text-[11px] text-tinta-suave">
                    centrar mapa en la región
                  </span>
                </span>
              </Option>
            );
          })}

          {suggestions.comunas.length > 0 && (
            <SectionHeader>comunas</SectionHeader>
          )}
          {suggestions.comunas.map((c) => {
            const idx = cursor++;
            return (
              <Option
                key={`comuna-${c.slug}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => pickItem({ kind: "comuna", data: c })}
                onMouseEnter={() => setActive(idx)}
              >
                <span className="w-8 h-8 rounded-lg bg-crema-deep inline-flex items-center justify-center text-bronceado shrink-0">
                  <IconMapPin size={16} stroke={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-carbon truncate">
                    {c.label}
                  </span>
                  <span className="block text-[11px] text-tinta-suave">
                    centrar mapa en la comuna
                  </span>
                </span>
              </Option>
            );
          })}

          {suggestions.picas.length > 0 && (
            <SectionHeader>listas</SectionHeader>
          )}
          {suggestions.picas.map((p) => {
            const idx = cursor++;
            return (
              <Option
                key={`pica-${p.slug}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => pickItem({ kind: "pica", data: p })}
                onMouseEnter={() => setActive(idx)}
              >
                <span className="w-8 h-8 rounded-lg bg-mostaza/15 inline-flex items-center justify-center text-mostaza shrink-0">
                  <PicaIcon name={p.icon} size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-carbon truncate">
                    {p.title}
                  </span>
                  <span className="block text-[11px] text-tinta-suave">
                    abrir lista curada
                  </span>
                </span>
              </Option>
            );
          })}

          {suggestions.users.length > 0 && (
            <SectionHeader>usuarios</SectionHeader>
          )}
          {suggestions.users.map((u) => {
            const idx = cursor++;
            return (
              <Option
                key={`user-${u.username}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => pickItem({ kind: "user", data: u })}
                onMouseEnter={() => setActive(idx)}
              >
                <span className="w-8 h-8 rounded-lg bg-lechuga/15 inline-flex items-center justify-center text-lechuga shrink-0">
                  <IconUser size={16} stroke={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-carbon truncate">
                    {u.name}
                  </span>
                  <span className="block text-[11px] text-tinta-suave truncate">
                    @{u.username}
                  </span>
                </span>
              </Option>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-bronceado font-medium">
      {children}
    </div>
  );
}

type OptionProps = {
  id: string;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  children: React.ReactNode;
};

function Option({
  id,
  isActive,
  onClick,
  onMouseEnter,
  children,
}: OptionProps) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={isActive}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        isActive ? "bg-crema-deep" : "bg-white hover:bg-crema-deep/60",
      )}
    >
      {children}
    </button>
  );
}
