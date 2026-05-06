"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
};

export type SegmentedControlProps<T extends string = string> = {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  /** "pill" = full rounded (lista|mapa). "rounded" = subtle (price range). */
  shape?: "pill" | "rounded";
};

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
  shape = "pill",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex bg-white border border-crema-edge p-[3px]",
        shape === "pill" ? "rounded-full" : "rounded-lg",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors",
              shape === "pill" ? "rounded-full" : "rounded-md",
              active ? "bg-carbon text-crema font-medium" : "text-carbon hover:bg-crema-deep",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
