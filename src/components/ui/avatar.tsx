import Image from "next/image";

import { cn } from "@/lib/utils";

type Props = {
  /** URL del avatar (R2). Si null, fallback a iniciales. */
  image: string | null | undefined;
  /** Iniciales para el fallback (suelen venir de `initialsFromName`). */
  initials: string;
  /** Tamaño en píxeles (cuadrado). Default 32. */
  size?: number;
  /** Clases extras (color de fondo fallback, borde, etc.). */
  className?: string;
  /** Alt text accesible. Default "avatar". */
  alt?: string;
};

/**
 * Avatar circular. Renderiza la foto si hay; si no, círculo de color con
 * iniciales. Usado en /perfil, /u/[username], cards de reseña y notificaciones.
 *
 * El tamaño se aplica como inline style (no clase) para soportar cualquier
 * número sin generar clases Tailwind dinámicas (que no se pueden purgar).
 */
export function Avatar({
  image,
  initials,
  size = 32,
  className,
  alt = "avatar",
}: Props) {
  if (image) {
    return (
      <div
        className={cn(
          "relative rounded-full overflow-hidden shrink-0",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src={image}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    );
  }

  // Fallback: círculo con iniciales. Tamaño de fuente ~38% del tamaño.
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium shrink-0",
        className ?? "bg-mostaza text-carbon",
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
      aria-label={alt}
    >
      {initials}
    </div>
  );
}
