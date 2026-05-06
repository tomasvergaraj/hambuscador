import { IconStar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type RatingPillProps = {
  rating: number;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Badge de rating con fondo carbón y texto/estrella mostaza.
 * Es una pieza de marca distintiva — usar siempre así, no inventar
 * variantes con otros colores.
 */
export function RatingPill({ rating, size = "md", className }: RatingPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-carbon text-mostaza rounded-md font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      <IconStar
        size={size === "sm" ? 10 : 12}
        stroke={2}
        className="fill-mostaza"
        aria-hidden="true"
      />
      {rating.toFixed(1)}
    </span>
  );
}
