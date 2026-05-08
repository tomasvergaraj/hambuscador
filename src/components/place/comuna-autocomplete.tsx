"use client";

import * as React from "react";
import {
  IconChevronDown,
  IconMapPin,
  IconSearch,
  IconWorld,
} from "@tabler/icons-react";

import { normalizeForSearch } from "@/lib/search";
import type { Comuna } from "@/server/services/comunas";
import { cn } from "@/lib/utils";

/**
 * Autocomplete sobre las 346 comunas de Chile (payload ~28KB filtrado client).
 * Modo híbrido:
 * - Sin query: dropdown agrupado por región plegable. Browse jerárquico para
 *   quien no sabe el nombre exacto.
 * - Con query: matches planos con relevance, igual que un autocomplete normal.
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

type RegionGroup = {
  slug: string;
  label: string;
  comunas: Comuna[];
};

type Item =
  | { kind: "header"; group: RegionGroup; expanded: boolean }
  | { kind: "comuna"; data: Comuna; indent: boolean };

export function ComunaAutocomplete({
  comunas,
  value,
  onChange,
  placeholder = "busca tu comuna...",
}: Props) {
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Agrupamos por región una sola vez; ordenamos región por label, comunas
  // dentro por label.
  const groups = React.useMemo<RegionGroup[]>(() => {
    const map = new Map<string, RegionGroup>();
    for (const c of comunas) {
      let g = map.get(c.regionSlug);
      if (!g) {
        g = { slug: c.regionSlug, label: c.regionLabel, comunas: [] };
        map.set(c.regionSlug, g);
      }
      g.comunas.push(c);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        comunas: [...g.comunas].sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [comunas]);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0 && trimmed !== value?.label;

  // Build de la lista plana de items según modo (search plano vs browse).
  const items = React.useMemo<Item[]>(() => {
    if (isSearching) {
      const norm = normalizeForSearch(trimmed);
      const matches = comunas
        .filter((c) => normalizeForSearch(c.label).includes(norm))
        .slice(0, 20);
      return matches.map((c) => ({ kind: "comuna" as const, data: c, indent: false }));
    }
    const list: Item[] = [];
    for (const g of groups) {
      const isExpanded = expanded.has(g.slug);
      list.push({ kind: "header", group: g, expanded: isExpanded });
      if (isExpanded) {
        for (const c of g.comunas) {
          list.push({ kind: "comuna", data: c, indent: true });
        }
      }
    }
    return list;
  }, [isSearching, trimmed, comunas, groups, expanded]);

  React.useEffect(() => {
    setActive(-1);
  }, [items]);

  const showDropdown = open && items.length > 0;

  const pick = (c: Comuna) => {
    onChange(c);
    setQuery(c.label);
    setOpen(false);
  };

  const toggleGroup = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
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
      setActive((p) => (p + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => (p - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      const picked = active >= 0 ? items[active] : undefined;
      if (!picked) return;
      e.preventDefault();
      if (picked.kind === "comuna") pick(picked.data);
      else toggleGroup(picked.group.slug);
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
          className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-crema-edge shadow-lg overflow-hidden max-h-72 overflow-y-auto"
        >
          {items.map((item, idx) => {
            const isActive = active === idx;
            const optId = `${LISTBOX_ID}-opt-${idx}`;
            if (item.kind === "header") {
              return (
                <button
                  key={`region-${item.group.slug}`}
                  id={optId}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleGroup(item.group.slug)}
                  onMouseEnter={() => setActive(idx)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-crema-edge/60",
                    isActive ? "bg-crema-deep" : "bg-crema-deep/40 hover:bg-crema-deep",
                  )}
                >
                  <span className="w-7 h-7 rounded-lg bg-white inline-flex items-center justify-center text-bronceado shrink-0">
                    <IconWorld size={14} stroke={1.75} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-carbon truncate">
                      {item.group.label}
                    </span>
                    <span className="block text-[11px] text-tinta-suave">
                      {item.group.comunas.length} comunas
                    </span>
                  </span>
                  <IconChevronDown
                    size={16}
                    className={cn(
                      "text-bronceado shrink-0 transition-transform",
                      item.expanded && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            }
            return (
              <button
                key={`comuna-${item.data.slug}`}
                id={optId}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item.data)}
                onMouseEnter={() => setActive(idx)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  item.indent && "pl-10",
                  isActive ? "bg-crema-deep" : "bg-white hover:bg-crema-deep/60",
                )}
              >
                <span className="w-7 h-7 rounded-lg bg-crema-deep inline-flex items-center justify-center text-bronceado shrink-0">
                  <IconMapPin size={14} stroke={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-carbon truncate">
                    {item.data.label}
                  </span>
                  {!item.indent && (
                    <span className="block text-[11px] text-tinta-suave truncate">
                      {item.data.regionLabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
