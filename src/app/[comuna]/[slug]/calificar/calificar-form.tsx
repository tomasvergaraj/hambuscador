"use client";

import { useActionState, useState } from "react";

import { Header } from "@/components/nav/header";
import { PhotoUploader } from "@/components/place/photo-uploader";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { REVIEW_ASPECTS } from "@/lib/constants";
import type { Place } from "@/types/place";

import { submitReview, type SubmitReviewState } from "./actions";

const initialState: SubmitReviewState = {};

export function CalificarForm({ place }: { place: Place }) {
  const [overallRating, setOverallRating] = useState(0);
  const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState(submitReview, initialState);

  const ratingLabel =
    overallRating >= 5
      ? "filete"
      : overallRating >= 4
        ? "muy buena"
        : overallRating >= 3
          ? "buena"
          : overallRating >= 2
            ? "regular"
            : overallRating >= 1
              ? "mala"
              : "toca una estrella";

  return (
    <form action={formAction} className="flex flex-col min-h-screen pb-24">
      <input type="hidden" name="placeId" value={place.id} />
      <input type="hidden" name="comuna" value={place.comuna} />
      <input type="hidden" name="slug" value={place.slug} />
      <input type="hidden" name="rating" value={overallRating} />
      <input
        type="hidden"
        name="aspect_comida"
        value={aspectRatings.comida ?? ""}
      />
      <input
        type="hidden"
        name="aspect_atencion"
        value={aspectRatings.atencion ?? ""}
      />
      <input
        type="hidden"
        name="aspect_ambiente"
        value={aspectRatings.ambiente ?? ""}
      />
      {photos.map((url) => (
        <input key={url} type="hidden" name="photos" value={url} />
      ))}

      <Header title="calificar" subtitle={place.name} isModal />

      <div className="px-4 pt-4">
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-4 text-center">
          <p className="text-[10px] text-bronceado tracking-widest font-medium">
            VALORACIÓN GENERAL
          </p>
          <div className="flex justify-center mt-3">
            <StarRating
              value={overallRating}
              onChange={setOverallRating}
              size="lg"
              aria-label="valoración general"
            />
          </div>
          <p className="text-xs text-carbon font-medium mt-3">{ratingLabel}</p>
        </div>
      </div>

      <section aria-labelledby="aspects-heading" className="px-4 pt-5">
        <p
          id="aspects-heading"
          className="text-[10px] text-bronceado tracking-widest font-medium mb-3"
        >
          CALIFICA POR ASPECTO
        </p>
        <div className="flex flex-col gap-2">
          {REVIEW_ASPECTS.map((aspect) => (
            <div
              key={aspect.id}
              className="flex items-center justify-between bg-crema-deep rounded-md border border-crema-edge px-3 py-2.5"
            >
              <span className="text-sm text-carbon">{aspect.label}</span>
              <StarRating
                value={aspectRatings[aspect.id] ?? 0}
                onChange={(value) =>
                  setAspectRatings((prev) => ({ ...prev, [aspect.id]: value }))
                }
                size="sm"
                aria-label={aspect.label}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <textarea
          name="text"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="cuéntale a otros cómo fue tu experiencia..."
          maxLength={1000}
          rows={4}
          className="w-full bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado resize-none"
        />
      </section>

      <section aria-label="agregar fotos" className="px-4 pt-4">
        <p className="text-[10px] text-bronceado tracking-widest font-medium mb-2">
          FOTOS (OPCIONAL)
        </p>
        <PhotoUploader value={photos} onChange={setPhotos} max={4} />
      </section>

      {state.error ? (
        <div className="px-4 pt-4">
          <p
            role="alert"
            className="text-xs text-tomate font-medium bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2"
          >
            {state.error}
          </p>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge px-4 py-3 z-30">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          type="submit"
          disabled={overallRating === 0 || pending}
        >
          {pending ? "publicando…" : "publicar reseña"}
        </Button>
      </div>
    </form>
  );
}
