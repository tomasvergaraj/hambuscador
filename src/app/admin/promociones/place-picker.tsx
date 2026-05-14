"use client";

import { IconRosetteDiscountCheckFilled, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

type SuggestPlace = {
  id: string;
  name: string;
  comuna: string;
  comunaLabel: string;
  slug: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
};

type Selected = Pick<SuggestPlace, "id" | "name" | "comunaLabel"> | null;

/**
 * Picker de local pa el form de crear promoción. Reusa /api/search/suggest
 * (debounce 200ms + AbortController). Selecciona uno → setea hidden input
 * `placeId` en el form padre.
 */
export function PlacePicker({ name = "placeId" }: { name?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuggestPlace[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (selected) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((data) => setResults((data.places ?? []) as SuggestPlace[]))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="bg-crema-deep border border-crema-edge rounded-md p-3 flex items-center gap-3">
        <input type="hidden" name={name} value={selected.id} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-sm text-carbon truncate">
            {selected.name}
          </p>
          <p className="text-[11px] text-bronceado">{selected.comunaLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQuery("");
          }}
          className="text-bronceado hover:text-carbon p-1 rounded-md hover:bg-crema-edge transition-colors"
          aria-label="cambiar local"
        >
          <IconX size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="buscar local por nombre…"
        className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado focus:outline-none focus:border-mostaza"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-crema-edge rounded-md shadow-lg max-h-80 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelected({ id: p.id, name: p.name, comunaLabel: p.comunaLabel });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-crema-deep flex items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm text-carbon">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.isVerified && (
                      <IconRosetteDiscountCheckFilled
                        size={13}
                        className="text-mostaza shrink-0"
                        aria-label="verificado"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-bronceado">{p.comunaLabel}</p>
                </div>
                <span className="text-[10px] text-bronceado shrink-0">
                  ★ {p.rating.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
