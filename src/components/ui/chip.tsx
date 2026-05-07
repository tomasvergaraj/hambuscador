"use client";

import * as React from "react";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  /** Cuando está seteado y el chip está activo, muestra una X para limpiar. */
  onRemove?: () => void;
};

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, onRemove, children, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-[transform,colors] duration-150 active:scale-[0.96]",
        active
          ? "bg-carbon text-crema font-medium"
          : "bg-white text-carbon border border-crema-edge hover:bg-crema-deep",
        className,
      )}
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
