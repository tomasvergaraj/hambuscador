"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchBar, type SearchBarProps } from "@/components/ui/search-bar";

type Props = Omit<SearchBarProps, "value" | "defaultValue" | "onValueChange" | "onClear"> & {
  /** Valor inicial de q desde la URL. */
  initialValue: string;
};

/**
 * Input de búsqueda con debounce que escribe `q` en la URL sin recargar.
 * Pensado para /buscar: filtros y resultados son server-side, esta capa solo
 * dispara la nav blanda. Pattern:
 *
 * - El usuario tipea → setValue inmediato (input siempre responsive).
 * - 200ms después de quietud → router.push con `q=...` y scroll:false.
 * - Si el usuario presiona Enter, push inmediato (sin esperar).
 * - Back/forward del browser actualiza `q` en URL → reflejamos en el input
 *   sin pisar lo que el usuario está tipeando ahora.
 *
 * `useTransition` da `isPending` para indicar "buscando" sutil.
 */
export function LiveSearchInput({ initialValue, ...rest }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [value, setValue] = React.useState(initialValue);
  const [isPending, startTransition] = React.useTransition();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = React.useRef(initialValue);

  // Sync desde URL: si `q` cambia externamente (back/forward, otra UI) y no
  // coincide con lo último que pusheamos, actualizamos el input. Si coincide,
  // significa que la URL refleja nuestro último push y no hacemos nada — eso
  // evita pisar lo que el usuario sigue tipeando.
  const urlQ = sp.get("q") ?? "";
  React.useEffect(() => {
    if (urlQ !== lastPushedRef.current) {
      setValue(urlQ);
      lastPushedRef.current = urlQ;
    }
  }, [urlQ]);

  const push = React.useCallback(
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(v), 200);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    push(value);
  };

  const onClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    push("");
  };

  return (
    <form onSubmit={onSubmit} role="search" className="relative w-full">
      <SearchBar
        value={value}
        onValueChange={onValueChange}
        onClear={onClear}
        {...rest}
      />
      {isPending && (
        <span
          aria-hidden="true"
          className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-mostaza border-t-transparent animate-spin"
        />
      )}
    </form>
  );
}
