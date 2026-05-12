"use client";

import * as React from "react";
import Image from "next/image";

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
 * Form para editar bio + avatar. Avatar va por R2 (PhotoUploader max=1).
 * Hidden inputs mirroran el state al action server-side. Redirige a /perfil
 * al guardar exitoso (el action redirige; el client no necesita reaccionar).
 */
export function EditProfileForm({ name, currentBio, currentImage }: Props) {
  const [state, formAction, pending] = React.useActionState(
    updateProfileAction,
    initial,
  );

  const [bio, setBio] = React.useState(currentBio ?? "");
  const [images, setImages] = React.useState<string[]>(
    currentImage ? [currentImage] : [],
  );

  const previewUrl = images[0] ?? currentImage ?? null;
  const initials = initialsFromName(name);
  const remaining = BIO_MAX - bio.length;
  const nearLimit = remaining < 30;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Avatar preview + uploader */}
      <section className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-mostaza-deep text-carbon flex items-center justify-center font-display font-semibold text-2xl relative border-2 border-crema-edge">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="tu avatar"
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <PhotoUploader value={images} onChange={setImages} max={1} />
        <input type="hidden" name="image" value={images[0] ?? ""} />
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
