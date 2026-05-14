"use client";

import { IconPhotoPlus, IconRefresh, IconX } from "@tabler/icons-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { requestUploadUrl } from "@/server/storage/actions";

// ============================================================================
// BrandLogoPicker — uploader + crop pa el logo de cadena.
//
// Flujo:
//   1. Admin elige archivo (jpg/png/webp, max 8MB).
//   2. Preview circular 220×220 con drag-to-pan + slider zoom.
//   3. "guardar" → renderiza canvas 256×256 (lo que se ve en el círculo)
//      → uploadea como PNG a R2 → emite publicUrl.
//
// El pin del mapa hace clip al mismo aspect ratio (círculo en el bulb),
// así que lo que el admin ve en el preview = lo que sale en el pin.
// ============================================================================

const PREVIEW_SIZE = 220;
const OUTPUT_SIZE = 256;
const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  value: string | null;
  onChange: (publicUrl: string | null) => void;
};

export function BrandLogoPicker({ value, onChange }: Props) {
  const [stage, setStage] = useState<"empty" | "editing" | "saving">("empty");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; startOff: { x: number; y: number } } | null>(
    null,
  );

  // ── Cuando llega un value existente (edit), mostrarlo como preview saved.
  // El admin puede "cambiar" subiendo otro.
  const showSaved = stage === "empty" && !!value && !img;

  // ── Redraw del preview cada vez que img/scale/offset cambian.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gris pa hint del área visible.
    ctx.fillStyle = "#E8DDD0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render image con scale + offset. Fit-cover base, después scale extra.
    const coverScale = Math.max(
      canvas.width / img.naturalWidth,
      canvas.height / img.naturalHeight,
    );
    const totalScale = coverScale * scale;
    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;
    const cx = canvas.width / 2 + offset.x;
    const cy = canvas.height / 2 + offset.y;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

    // Overlay: oscurecer fuera del círculo pa indicar crop.
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    // No usar destination-out — querés mantener todo dentro, opacar fuera.
    // Forma simple: dibujar overlay con hueco.
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "rgba(31, 27, 23, 0.45)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();

    // Stroke del círculo.
    ctx.beginPath();
    ctx.strokeStyle = "#E8A02C";
    ctx.lineWidth = 2;
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
  }, [img, scale, offset]);

  function onFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      setError(`archivo > ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setStage("editing");
    };
    image.onerror = () => setError("no se pudo cargar la imagen");
    image.src = url;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (stage !== "editing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOff: { ...offset },
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({
      x: dragRef.current.startOff.x + dx,
      y: dragRef.current.startOff.y + dy,
    });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  }

  async function save() {
    if (!img) return;
    setError(null);
    setStage("saving");

    // Render a canvas OUTPUT_SIZE × OUTPUT_SIZE con el crop exacto.
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) {
      setError("canvas no disponible");
      setStage("editing");
      return;
    }
    // Background transparente — el círculo en el render final va clipped.
    // Pero exportamos PNG completo cuadrado (lo que ESTÁ dentro del círculo
    // del preview, todo el cuadrado pa simplificar — el clip lo hace el pin).
    const coverScale = Math.max(
      OUTPUT_SIZE / img.naturalWidth,
      OUTPUT_SIZE / img.naturalHeight,
    );
    const totalScale = coverScale * scale;
    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;
    const offRatio = OUTPUT_SIZE / PREVIEW_SIZE;
    const cx = OUTPUT_SIZE / 2 + offset.x * offRatio;
    const cy = OUTPUT_SIZE / 2 + offset.y * offRatio;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) {
      setError("no se pudo generar imagen");
      setStage("editing");
      return;
    }

    try {
      const result = await requestUploadUrl({
        filename: `brand-logo.png`,
        contentType: "image/png",
        size: blob.size,
      });
      if (!result.ok) {
        setError(result.error);
        setStage("editing");
        return;
      }
      const putResp = await fetch(result.uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/png" },
      });
      if (!putResp.ok) {
        setError(`upload falló (${putResp.status})`);
        setStage("editing");
        return;
      }
      onChange(result.publicUrl);
      setImg(null);
      setStage("empty");
    } catch {
      setError("error de red al subir");
      setStage("editing");
    }
  }

  function cancel() {
    setImg(null);
    setError(null);
    setStage("empty");
  }

  function clear() {
    onChange(null);
    setImg(null);
    setStage("empty");
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (stage === "editing" || stage === "saving") {
    return (
      <div className="flex flex-col gap-3">
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="rounded-md border border-crema-edge bg-crema-deep cursor-grab active:cursor-grabbing touch-none self-start"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        />
        <p className="text-[11px] text-bronceado">
          arrastra pa reposicionar · slider pa zoom · lo dentro del círculo
          es lo que aparece en el pin del mapa.
        </p>
        <div className="flex items-center gap-2">
          <label
            htmlFor="brand-logo-zoom"
            className="text-xs text-tinta-suave shrink-0"
          >
            zoom
          </label>
          <input
            id="brand-logo-zoom"
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-mostaza"
            disabled={stage === "saving"}
          />
          <span className="text-[11px] text-bronceado w-10 text-right">
            {scale.toFixed(2)}x
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={cancel}
            disabled={stage === "saving"}
          >
            cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            onClick={save}
            disabled={stage === "saving"}
          >
            {stage === "saving" ? "guardando..." : "guardar logo"}
          </Button>
        </div>
        {error && (
          <p className="text-[11px] text-tomate bg-tomate/10 border border-tomate/30 rounded px-2 py-1">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Empty / saved view
  return (
    <div className="flex items-start gap-3">
      <div className="w-[88px] h-[88px] shrink-0 rounded-full border border-crema-edge bg-crema-deep overflow-hidden flex items-center justify-center">
        {showSaved && value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="logo actual" className="w-full h-full object-cover" />
        ) : (
          <IconPhotoPlus
            size={22}
            stroke={1.5}
            className="text-bronceado opacity-60"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="brand-logo-file"
          className="inline-flex items-center gap-1.5 bg-mostaza text-carbon font-medium text-sm px-3 py-2 rounded-md hover:bg-mostaza-deep transition-colors cursor-pointer self-start"
        >
          {showSaved ? (
            <>
              <IconRefresh size={14} aria-hidden="true" /> cambiar
            </>
          ) : (
            <>
              <IconPhotoPlus size={14} aria-hidden="true" /> subir logo
            </>
          )}
        </label>
        <input
          id="brand-logo-file"
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {showSaved && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-[11px] text-tomate hover:text-tomate/80 self-start"
          >
            <IconX size={11} aria-hidden="true" /> quitar
          </button>
        )}
        {error && (
          <p className="text-[11px] text-tomate">{error}</p>
        )}
      </div>
    </div>
  );
}
