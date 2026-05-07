"use client";

import { IconPhotoPlus, IconX } from "@tabler/icons-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { requestUploadUrl } from "@/server/storage/actions";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_SIZE_MB = 8;

type Props = {
  /**
   * Lista de URLs públicas ya subidas. El padre la mantiene en su state.
   */
  value: string[];
  onChange: (urls: string[]) => void;
  /**
   * Cantidad máxima de fotos. Default 4.
   */
  max?: number;
};

/**
 * Sube fotos directo a R2 (presigned PUT) y devuelve las URLs públicas al
 * padre via `onChange`. Soporta preview, eliminar, validación de tipo/tamaño.
 *
 * En modo demo sin storage configurado, el primer intento de upload muestra
 * un error explicativo.
 */
export function PhotoUploader({ value, onChange, max = 4 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const remaining = max - value.length;
    if (remaining <= 0) {
      setError(`máximo ${max} fotos`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setUploading(true);

    const newUrls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} pesa más de ${MAX_SIZE_MB} MB`);
        continue;
      }

      try {
        const result = await requestUploadUrl({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        if (!result.ok) {
          setError(result.error);
          continue;
        }

        const putResp = await fetch(result.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!putResp.ok) {
          setError(`falló la subida de ${file.name}`);
          continue;
        }

        newUrls.push(result.publicUrl);
      } catch {
        setError(`error subiendo ${file.name}`);
      }
    }

    if (newUrls.length > 0) {
      onChange([...value, ...newUrls]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const slotsLeft = Math.max(0, max - value.length);

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        disabled={uploading || slotsLeft === 0}
      />

      <div className="flex gap-2 flex-wrap">
        {value.map((url, i) => (
          <div
            key={url}
            className="relative w-20 h-20 rounded-md overflow-hidden border border-crema-edge bg-crema-deep"
          >
            <Image
              src={url}
              alt={`foto ${i + 1}`}
              fill
              sizes="80px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`quitar foto ${i + 1}`}
              className="absolute top-0.5 right-0.5 w-5 h-5 inline-flex items-center justify-center rounded-full bg-carbon/80 text-crema hover:bg-carbon"
            >
              <IconX size={12} stroke={2.5} />
            </button>
          </div>
        ))}

        {slotsLeft > 0 ? (
          <label
            htmlFor={inputId}
            className={`w-20 h-20 inline-flex flex-col items-center justify-center gap-0.5 border border-dashed border-crema-edge rounded-md text-bronceado hover:border-bronceado cursor-pointer ${
              uploading ? "opacity-50 cursor-wait" : ""
            }`}
          >
            <IconPhotoPlus size={18} aria-hidden="true" />
            <span className="text-[10px]">{uploading ? "subiendo…" : "agregar"}</span>
          </label>
        ) : null}
      </div>

      <p className="text-[10px] text-bronceado mt-1.5">
        máximo {max} fotos · jpg, png o webp · hasta {MAX_SIZE_MB} MB cada una
      </p>

      {error ? (
        <p
          role="alert"
          className="text-[11px] text-tomate mt-1 bg-tomate/10 border border-tomate/30 rounded px-2 py-1"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
