"use client";

import { IconTrash } from "@tabler/icons-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "@/components/place/photo-uploader";
import { initialsFromName } from "@/lib/utils";

import { updateProfileAction, type UpdateProfileState } from "../actions";

const initial: UpdateProfileState = {};
const BIO_MAX = 280;

type Props = {
  name: string;
  currentBio: string | null;
  currentImage: string | null;
};

/**
 * Form para editar bio + avatar.
 *
 * El avatar tiene 3 modos que se envían vía `imageMode` al action:
 *   - keep: no toca image (default si user no interactúa con avatar)
 *   - new: subió foto al R2 → action guarda la URL nueva
 *   - remove: clicked quitar → action setea null (vuelve a iniciales)
 *
 * El PhotoUploader empieza vacío SIEMPRE — su rol es subir, no mostrar la
 * actual. La actual va en preview separado arriba. Esto evita que el alt
 * "foto 1" se vea cuando la imagen no carga (ej. Google avatar con CSP
 * restrictiva). El Avatar component sí soporta cualquier URL configurada en
 * next.config.remotePatterns y cae a iniciales si la imagen falla.
 */
export function EditProfileForm({ name, currentBio, currentImage }: Props) {
  const [state, formAction, pending] = React.useActionState(
    updateProfileAction,
    initial,
  );

  const [bio, setBio] = React.useState(currentBio ?? "");
  const [uploaded, setUploaded] = React.useState<string[]>([]);
  const [removeRequested, setRemoveRequested] = React.useState(false);

  const initials = initialsFromName(name);
  const newImage = uploaded[0] ?? null;

  // Preview prioriza foto nueva, después la actual (si no se pidió borrar).
  const previewImage = newImage ?? (removeRequested ? null : currentImage);

  const imageMode = newImage ? "new" : removeRequested ? "remove" : "keep";
  const showRemove = Boolean(currentImage) && !newImage && !removeRequested;
  const showUndoRemove = removeRequested && !newImage;

  const remaining = BIO_MAX - bio.length;
  const nearLimit = remaining < 30;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Avatar preview + uploader */}
      <section className="flex flex-col items-center gap-3">
        <Avatar
          image={previewImage}
          initials={initials}
          size={96}
          className="bg-mostaza-deep text-carbon font-display font-semibold border-2 border-crema-edge"
          alt={`avatar de ${name}`}
        />

        <PhotoUploader value={uploaded} onChange={setUploaded} max={1} />

        {showRemove && (
          <button
            type="button"
            onClick={() => setRemoveRequested(true)}
            className="inline-flex items-center gap-1 text-[11px] text-tomate hover:opacity-80 transition-opacity"
          >
            <IconTrash size={12} aria-hidden="true" /> quitar foto actual
          </button>
        )}
        {showUndoRemove && (
          <button
            type="button"
            onClick={() => setRemoveRequested(false)}
            className="text-[11px] text-tinta-suave hover:text-carbon transition-colors"
          >
            deshacer
          </button>
        )}

        <input type="hidden" name="imageMode" value={imageMode} />
        <input type="hidden" name="image" value={newImage ?? ""} />
      </section>

      {/* Bio textarea */}
      <section className="flex flex-col gap-2">
        <label className="font-display font-semibold text-sm text-carbon" htmlFor="bio">
          sobre ti
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          placeholder="cuéntale al resto qué te gusta comer, dónde sueles ir, qué hamburguesa amas..."
          rows={4}
          className="bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado leading-relaxed resize-none"
        />
        <p
          className={`text-[10px] self-end ${nearLimit ? "text-tomate" : "text-bronceado"}`}
        >
          {remaining} caracteres restantes
        </p>
      </section>

      {state.error ? (
        <p
          role="alert"
          className="text-xs text-tomate bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? "guardando..." : "guardar cambios"}
      </Button>
    </form>
  );
}
