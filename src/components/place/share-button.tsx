"use client";

import { IconCheck, IconShare } from "@tabler/icons-react";
import { useEffect, useState } from "react";

// ============================================================================
// ShareButton — Web Share API con fallback a clipboard.
// En mobile (Chrome/Safari) abre el dialog nativo. En desktop / browsers
// sin soporte cae a `navigator.clipboard.writeText` y muestra "copiado".
// ============================================================================

type Props = {
  /** Path relativo (ej. "/quillota/el-quillotano-burger"). Se resuelve a URL absoluta en client. */
  path: string;
  title: string;
  text?: string;
};

export function ShareButton({ path, title, text }: Props) {
  const [copied, setCopied] = useState(false);

  // Reseteamos el estado "copiado" después de 2s
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function handleClick() {
    const url = new URL(path, window.location.origin).toString();
    const shareData: ShareData = { title, text, url };

    if (typeof navigator.share === "function" && navigator.canShare?.(shareData) !== false) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // AbortError: usuario canceló — no hacer nada
        if ((err as Error).name === "AbortError") return;
        // Otros errores caen al fallback
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Último fallback: nada elegante, pero al menos no rompe
      window.prompt("Copia el link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "link copiado" : "compartir"}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-carbon hover:bg-crema-deep transition-[transform,colors] duration-150 active:scale-90"
    >
      {copied ? (
        <IconCheck size={18} className="text-lechuga" aria-hidden="true" />
      ) : (
        <IconShare size={18} aria-hidden="true" />
      )}
    </button>
  );
}
