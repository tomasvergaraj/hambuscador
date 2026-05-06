"use client";

import * as React from "react";
import { IconStar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type StarRatingProps = {
  /** Calificación actual, 0–5. */
  value: number;
  /** Pasar un setter para hacerlo interactivo. Sin él es read-only. */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
};

const sizes: Record<NonNullable<StarRatingProps["size"]>, number> = {
  sm: 14,
  md: 20,
  lg: 28,
};

export function StarRating({
  value,
  onChange,
  size = "md",
  className,
  ariaLabel = "Calificación",
}: StarRatingProps) {
  const interactive = !!onChange;
  const pixelSize = sizes[size];

  return (
    <div
      role={interactive ? "radiogroup" : "img"}
      aria-label={ariaLabel}
      className={cn("inline-flex gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const Star = (
          <IconStar
            size={pixelSize}
            stroke={1.75}
            className={cn(
              filled ? "fill-mostaza text-mostaza" : "text-crema-edge",
            )}
            aria-hidden="true"
          />
        );

        if (!interactive) return <span key={n}>{Star}</span>;

        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            onClick={() => onChange?.(n)}
            className="cursor-pointer"
          >
            {Star}
          </button>
        );
      })}
    </div>
  );
}
