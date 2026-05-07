"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SearchBar } from "@/components/ui/search-bar";

/**
 * Search del home. NO es live: en home el usuario está browseando, no tiene
 * sentido cambiar la página por cada tecla. Patrón:
 *
 * - Submit (Enter) → push a /buscar?q=...
 * - Click en X → limpiar input local (sin navegar)
 *
 * Si quieres búsqueda live, eso vive en /buscar via LiveSearchInput.
 */
export function HomeSearchInput() {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
  };

  return (
    <form onSubmit={onSubmit} role="search">
      <SearchBar
        value={value}
        onValueChange={setValue}
        onClear={() => setValue("")}
        placeholder="busca por barrio o nombre"
      />
    </form>
  );
}
