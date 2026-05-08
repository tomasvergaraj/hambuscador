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

import { SearchBar, type SearchBarProps } from "@/components/ui/search-bar";
import {
  useSearchSuggestions,
  type ComunaSuggestion,
  type PlaceSuggestion,
  type RegionSuggestion,
  type UserSuggestion,
} from "@/lib/use-search-suggestions";
import { cn } from "@/lib/utils";

/**
 * Input de búsqueda con debounce que escribe `q` en la URL sin recargar +
 * dropdown de sugerencias. Pensado para `/buscar?vista=lista`.
 *
 * Doble función:
 * - Tipear → debounced 200ms → push de `?q=…` para filtrar resultados live.
 * - Tipear → debounced 150ms (en el hook) → fetch de sugerencias.
 *
 * Acciones del dropdown (distintas de mapa: acá no hay flyTo):
 * - Place → `/${comuna}/${slug}` (ficha del local).
 * - Comuna/Región → reemplaza `q` por la label, manteniendo filtros activos.
 * - Picás se omiten — la card "lista relacionada" inline ya las cubre.
 */

const LISTBOX_ID = "live-search-listbox";

type Props = Omit<
  SearchBarProps,
  "value" | "defaultValue" | "onValueChange" | "onClear"
> & {
  initialValue: string;
};

export function LiveSearchInput({ initialValue, ...rest }: Props) {
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

  const urlQ = sp.get("q") ?? "";
  React.useEffect(() => {
    if (urlQ !== lastPushedRef.current) {
      setValue(urlQ);
      lastPushedRef.current = urlQ;
    }
  }, [urlQ]);

  const pushQuery = React.useCallback(
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
    debounceRef.current = setTimeout(() => pushQuery(v), 200);
  };

  const onClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    setOpen(false);
    pushQuery("");
  };

  // Lista plana para keyboard nav: places → regions → comunas → users.
  // Skip picas — la card "lista relacionada" inline ya cubre ese caso.
  type Item =
    | { kind: "place"; data: PlaceSuggestion }
    | { kind: "region"; data: RegionSuggestion }
    | { kind: "comuna"; data: ComunaSuggestion }
    | { kind: "user"; data: UserSuggestion };
  const items = React.useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const p of suggestions.places) list.push({ kind: "place", data: p });
    for (const r of suggestions.regions) list.push({ kind: "region", data: r });
    for (const c of suggestions.comunas) list.push({ kind: "comuna", data: c });
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
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (item.kind === "place") {
      router.push(`/${item.data.comuna}/${item.data.slug}`);
      return;
    }
    if (item.kind === "user") {
      router.push(`/u/${item.data.username}`);
      return;
    }

    // region / comuna → reemplazar q por la label y mantener resto de filtros.
    const label = item.data.label;
    setValue(label);
    pushQuery(label);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const picked = active >= 0 ? items[active] : undefined;
    if (showDropdown && picked) {
      pickItem(picked);
      return;
    }
    pushQuery(value);
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
                    filtrar por la región
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
                    filtrar por la comuna
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
                    {u.reviewCount > 0 && (
                      <>
                        <span className="mx-1">·</span>
                        {u.reviewCount} {u.reviewCount === 1 ? "reseña" : "reseñas"}
                      </>
                    )}
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
