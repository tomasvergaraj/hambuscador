import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "icon" | "icon-mono";
  size?: number; // altura en px (el ancho se calcula)
  className?: string;
  monoColor?: string; // solo aplica a variant="icon-mono"
  "aria-label"?: string;
};

/**
 * Logo de Hambuscador. Por defecto el logo completo (icono + wordmark).
 * Usa SVG inline para que herede color via currentColor cuando aplique.
 *
 * @example
 * <Logo variant="full" size={32} />
 * <Logo variant="icon" size={48} />
 * <Logo variant="icon-mono" className="text-carbon" size={20} />
 */
export function Logo({
  variant = "full",
  size = 28,
  className,
  monoColor,
  "aria-label": ariaLabel = "Hambuscador",
}: LogoProps) {
  if (variant === "icon-mono") {
    return (
      <svg
        viewBox="0 0 64 64"
        height={size}
        width={size}
        role="img"
        aria-label={ariaLabel}
        className={cn(className)}
        style={monoColor ? { color: monoColor } : undefined}
      >
        <path
          d="M6,30 C6,14 18,6 32,6 C46,6 58,14 58,30 L58,50 C58,55 46,58 32,58 C18,58 6,55 6,50 Z"
          fill="currentColor"
        />
        <ellipse cx="22" cy="20" rx="1.6" ry="2.1" fill="#FAF6EE" fillOpacity="0.92" />
        <ellipse cx="32" cy="15" rx="1.6" ry="2.1" fill="#FAF6EE" fillOpacity="0.92" />
        <ellipse cx="42" cy="20" rx="1.6" ry="2.1" fill="#FAF6EE" fillOpacity="0.92" />
        <line
          x1="4"
          y1="36.5"
          x2="60"
          y2="36.5"
          stroke="#FAF6EE"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <line
          x1="4"
          y1="46.5"
          x2="60"
          y2="46.5"
          stroke="#FAF6EE"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
      </svg>
    );
  }

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 64 64"
        height={size}
        width={size}
        role="img"
        aria-label={ariaLabel}
        className={cn(className)}
      >
        <path d="M6,30 C6,14 18,6 32,6 C46,6 58,14 58,30 Z" fill="#E8A02C" />
        <ellipse cx="22" cy="20" rx="1.4" ry="1.9" fill="#FAF6EE" />
        <ellipse cx="32" cy="15" rx="1.4" ry="1.9" fill="#FAF6EE" />
        <ellipse cx="42" cy="20" rx="1.4" ry="1.9" fill="#FAF6EE" />
        <path
          d="M4,30 L60,30 L60,34 Q56,37 52,34 Q48,37 44,34 Q40,37 36,34 Q32,37 28,34 Q24,37 20,34 Q16,37 12,34 Q8,37 4,34 Z"
          fill="#6B8E4E"
        />
        <rect x="4" y="36" width="56" height="10" rx="2.5" fill="#3E2723" />
        <path d="M6,46 L58,46 L58,50 C58,55 46,58 32,58 C18,58 6,55 6,50 Z" fill="#C8862A" />
      </svg>
    );
  }

  // variant === "full"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Logo variant="icon" size={size} aria-label="" />
      <span
        className="font-display font-semibold leading-none text-carbon"
        style={{
          fontSize: size * 0.64,
          letterSpacing: "-0.04em",
        }}
      >
        hambuscador
      </span>
    </div>
  );
}
