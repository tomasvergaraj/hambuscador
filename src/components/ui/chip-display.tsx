import * as React from "react";
import { cn } from "@/lib/utils";

// Estilo compartido por Chip (button interactivo) y ChipDisplay (span pasivo).
// Vive acá pa que ambos componentes lo importen sin forzar a Chip ("use client")
// a re-exportar — un import desde un client component a un server-compat module
// es válido al revés.
export function chipClassName(active: boolean, extra?: string): string {
  return cn(
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-[transform,colors] duration-150 active:scale-[0.96]",
    active
      ? "bg-carbon text-crema font-medium"
      : "bg-white text-carbon border border-crema-edge hover:bg-crema-deep",
    extra,
  );
}

export type ChipDisplayProps = React.HTMLAttributes<HTMLSpanElement> & {
  active?: boolean;
};

/**
 * Versión visual (span) del chip — server-renderable. Para uso pasivo dentro
 * de un `<Link>` o `<a>` donde el interactivo es el ancestor.
 *
 * No anidar `<button>` (Chip) dentro de `<a>` (Link) — es HTML inválido.
 */
export function ChipDisplay({
  active = false,
  children,
  className,
  ...props
}: ChipDisplayProps) {
  return (
    <span className={chipClassName(active, className)} {...props}>
      {children}
    </span>
  );
}
