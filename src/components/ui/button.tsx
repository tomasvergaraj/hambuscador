import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botón principal del sistema. Variantes:
 * - primary: mostaza, CTA principal
 * - secondary: blanco con borde, acción secundaria
 * - ghost: transparente, navegación inline
 * - danger: tomate, acciones destructivas
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mostaza focus-visible:ring-offset-2 focus-visible:ring-offset-crema",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-mostaza text-carbon hover:bg-mostaza-deep active:scale-[0.98] font-display font-semibold",
        secondary:
          "bg-white text-carbon border border-crema-edge hover:bg-crema-deep",
        ghost: "bg-transparent text-carbon hover:bg-crema-deep",
        danger:
          "bg-tomate text-white hover:opacity-90 font-display font-semibold",
      },
      size: {
        sm: "px-3 py-2 text-xs rounded-md gap-1.5",
        md: "px-4 py-2.5 text-sm rounded-lg gap-2",
        lg: "px-5 py-3 text-base rounded-xl gap-2",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
});
