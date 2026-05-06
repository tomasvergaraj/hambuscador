"use client";

import * as React from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SearchBarProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> & {
  value?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  containerClassName?: string;
};

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      value,
      placeholder = "busca por barrio o nombre",
      onValueChange,
      onClear,
      containerClassName,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-crema-edge",
          "focus-within:border-mostaza transition-colors",
          containerClassName,
        )}
      >
        <IconSearch
          size={16}
          stroke={1.75}
          className="text-bronceado shrink-0"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="search"
          value={value ?? ""}
          onChange={(e) => onValueChange?.(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent text-sm text-carbon placeholder:text-bronceado outline-none min-w-0",
            className,
          )}
          {...props}
        />
        {value && (onClear || onValueChange) ? (
          <button
            type="button"
            onClick={() => {
              onClear?.();
              onValueChange?.("");
            }}
            aria-label="Limpiar búsqueda"
            className="text-bronceado hover:text-carbon shrink-0"
          >
            <IconX size={16} stroke={1.75} />
          </button>
        ) : null}
      </div>
    );
  },
);
