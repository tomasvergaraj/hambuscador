"use client";

import * as React from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SearchBarProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size"
> & {
  /** Cuando está seteado, el input es controlado. Si no, es uncontrolled (usa `defaultValue`). */
  value?: string;
  size?: "md" | "lg";
  placeholder?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  containerClassName?: string;
};

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      value,
      defaultValue,
      placeholder = "busca por barrio o nombre",
      size = "md",
      onValueChange,
      onClear,
      containerClassName,
      className,
      ...props
    },
    ref,
  ) {
    const isControlled = value !== undefined;
    const sizeClasses =
      size === "lg" ? "px-3.5 py-3 text-base" : "px-3 py-2.5 text-sm";

    return (
      <div
        className={cn(
          "flex items-center gap-2.5 bg-white rounded-xl border border-crema-edge",
          "focus-within:border-mostaza transition-colors",
          sizeClasses,
          containerClassName,
        )}
      >
        <IconSearch
          size={size === "lg" ? 18 : 16}
          stroke={1.75}
          className="text-bronceado shrink-0"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="search"
          {...(isControlled
            ? { value, onChange: (e) => onValueChange?.(e.target.value) }
            : {
                defaultValue,
                onChange: onValueChange
                  ? (e) => onValueChange(e.target.value)
                  : undefined,
              })}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent text-carbon placeholder:text-bronceado outline-none min-w-0",
            className,
          )}
          {...props}
        />
        {isControlled && value && (onClear || onValueChange) ? (
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
