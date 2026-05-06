import { cn } from "@/lib/utils";

type ProgressDotsProps = {
  /** Total de pasos. */
  total: number;
  /** Paso actual, 1-indexed. Pasos < current y === current se rellenan. */
  current: number;
  className?: string;
};

/**
 * Indicador de progreso del wizard. Se renderiza como N segmentos
 * horizontales rellenos hasta el paso actual.
 */
export function ProgressDots({ total, current, className }: ProgressDotsProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Paso ${current} de ${total}`}
      className={cn("flex items-center gap-2", className)}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < current;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              isFilled ? "bg-mostaza" : "bg-crema-edge",
            )}
          />
        );
      })}
    </div>
  );
}
