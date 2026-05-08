"use client";

// ============================================================================
// useSearchSuggestions — hook compartido para el dropdown de search.
// ----------------------------------------------------------------------------
// Consume `/api/search/suggest?q=…` con debounce 150ms + AbortController para
// cancelar requests en vuelo. Devuelve siempre las 4 secciones (vacías si la
// query es < 2 chars). Cada consumer (home, mapa) decide qué secciones
// renderizar y qué hacer al click.
// ============================================================================

import * as React from "react";

import type { PicaIconName } from "./picas";

export type PlaceSuggestion = {
  id: string;
  name: string;
  comuna: string;
  comunaLabel: string;
  slug: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  lat: number;
  lng: number;
};

export type PicaSuggestion = {
  slug: string;
  title: string;
  icon: PicaIconName;
};

export type ComunaSuggestion = {
  slug: string;
  label: string;
  lat: number;
  lng: number;
};

export type RegionSuggestion = {
  slug: string;
  label: string;
  lat: number;
  lng: number;
  zoom: number;
};

export type SearchSuggestions = {
  places: PlaceSuggestion[];
  picas: PicaSuggestion[];
  comunas: ComunaSuggestion[];
  regions: RegionSuggestion[];
};

const EMPTY: SearchSuggestions = {
  places: [],
  picas: [],
  comunas: [],
  regions: [],
};

export function useSearchSuggestions(value: string): SearchSuggestions {
  const [suggestions, setSuggestions] = React.useState<SearchSuggestions>(EMPTY);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = value.trim();
    if (q.length < 2) {
      setSuggestions(EMPTY);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<SearchSuggestions>) : null))
        .then((data) => {
          if (data) setSuggestions(data);
        })
        .catch(() => {
          // abortado o red — silencioso
        });
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return suggestions;
}
