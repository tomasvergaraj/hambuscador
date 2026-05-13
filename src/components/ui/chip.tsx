"use client";

import * as React from "react";
import { IconX } from "@tabler/icons-react";
import { chipClassName } from "./chip-display";

export type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  /** Cuando está seteado y el chip está activo, muestra una X para limpiar. */
  onRemove?: () => void;
};

/**
 * Chip interactivo (button) — para filtros con estado, toggles, multi-select.
 * Si lo necesitás como visual dentro de un `<Link>`, usá `ChipDisplay`
 * (`./chip-display`) — `<button>` dentro de `<a>` es HTML inválido.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, onRemove, children, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={chipClassName(active, className)}
      {...props}
    >
      {children}
      {onRemove && active ? (
        <span
          role="button"
          tabIndex={0}
          aria-label="Quitar filtro"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="-mr-0.5 inline-flex"
        >
          <IconX size={12} stroke={2} />
        </span>
      ) : null}
    </button>
  );
});
