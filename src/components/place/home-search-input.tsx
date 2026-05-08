"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconMapPin,
  IconRosetteDiscountCheckFilled,
  IconSearch,
  IconStarFilled,
} from "@tabler/icons-react";

import { PicaIcon } from "@/components/place/pica-icon";
import { SearchBar } from "@/components/ui/search-bar";
import {
  useSearchSuggestions,
  type ComunaSuggestion,
  type PicaSuggestion,
  type PlaceSuggestion,
} from "@/lib/use-search-suggestions";
import { cn } from "@/lib/utils";

/**
 * Search del home con dropdown de sugerencias agrupadas (locales / picás /
 * comunas). NO es búsqueda live — submit/click navega a la página destino.
 *
 * - Tipear → debounce 150ms (en el hook) → fetch a `/api/search/suggest?q=…`.
 * - ↓/↑ → recorre opciones planas (todas las secciones concatenadas).
 * - Enter sin opción seleccionada → /buscar?q=… (free text).
 * - Enter sobre opción → navega al destino de esa opción.
 * - Esc → cierra dropdown sin perder lo tipeado.
 * - Click fuera → cierra.
 *
 * El input usa el patrón ARIA combobox-listbox con `aria-activedescendant`
 * para que screen readers anuncien la opción resaltada sin mover el foco.
 */

const LISTBOX_ID = "home-search-listbox";

export function HomeSearchInput() {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const suggestions = useSearchSuggestions(value);

  // Lista plana para keyboard nav: places → picas → comunas, en ese orden.
  // Las regions se omiten en home (no hay flyTo aquí).
  type Item =
    | { kind: "place"; data: PlaceSuggestion; href: string }
    | { kind: "pica"; data: PicaSuggestion; href: string }
    | { kind: "comuna"; data: ComunaSuggestion; href: string };
  const items = React.useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const p of suggestions.places) {
      list.push({ kind: "place", data: p, href: `/${p.comuna}/${p.slug}` });
    }
    for (const p of suggestions.picas) {
      list.push({ kind: "pica", data: p, href: `/picas/${p.slug}` });
    }
    for (const c of suggestions.comunas) {
      list.push({ kind: "comuna", data: c, href: `/buscar?q=${encodeURIComponent(c.label)}` });
    }
    return list;
  }, [suggestions]);

  // Reset del highlight cuando cambian los items.
  React.useEffect(() => {
    setActive(-1);
  }, [items]);

  // Click fuera cierra.
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

  const submitFreeText = () => {
    const q = value.trim();
    setOpen(false);
    router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
  };

  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (!showDropdown) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitFreeText();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = active >= 0 ? items[active] : undefined;
      if (picked) navigateTo(picked.href);
      else submitFreeText();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitFreeText();
        }}
        role="search"
      >
        <SearchBar
          value={value}
          onValueChange={(v) => {
            setValue(v);
            setOpen(true);
          }}
          onClear={() => {
            setValue("");
            setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="busca por barrio o nombre"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={
            active >= 0 ? `${LISTBOX_ID}-opt-${active}` : undefined
          }
        />
      </form>

      {showDropdown && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-crema-edge shadow-lg overflow-hidden"
        >
          {suggestions.places.length > 0 && (
            <SectionHeader>locales</SectionHeader>
          )}
          {suggestions.places.map((p, i) => {
            const idx = i;
            return (
              <Option
                key={`place-${p.id}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => navigateTo(`/${p.comuna}/${p.slug}`)}
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

          {suggestions.picas.length > 0 && (
            <SectionHeader>listas</SectionHeader>
          )}
          {suggestions.picas.map((p, i) => {
            const idx = suggestions.places.length + i;
            return (
              <Option
                key={`pica-${p.slug}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() => navigateTo(`/picas/${p.slug}`)}
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
                    lista curada
                  </span>
                </span>
              </Option>
            );
          })}

          {suggestions.comunas.length > 0 && (
            <SectionHeader>comunas</SectionHeader>
          )}
          {suggestions.comunas.map((c, i) => {
            const idx =
              suggestions.places.length + suggestions.picas.length + i;
            return (
              <Option
                key={`comuna-${c.slug}`}
                id={`${LISTBOX_ID}-opt-${idx}`}
                isActive={active === idx}
                onClick={() =>
                  navigateTo(`/buscar?q=${encodeURIComponent(c.label)}`)
                }
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
                    ver picás de la comuna
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
        // Evita que el input pierda el foco antes de que dispare el click.
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
