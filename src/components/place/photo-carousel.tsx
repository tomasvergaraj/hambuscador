"use client";

import { IconPhoto } from "@tabler/icons-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// PhotoCarousel — hero scrollable horizontal con scroll-snap.
// Sin lib externa: scroll-snap nativo + IntersectionObserver para tracking
// del slide activo (alimenta los dots).
// ============================================================================

type Props = {
  photos: string[];
  /** Para alt text accesible. */
  placeName: string;
};

export function PhotoCarousel({ photos, placeName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || photos.length <= 1) return;

    // Tracking via IntersectionObserver — más estable que scroll handler
    // (que dispara N veces durante un swipe). El threshold 0.6 evita
    // flickear el dot en el medio del scroll.
    const slides = container.querySelectorAll<HTMLElement>("[data-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute("data-slide"));
            setActive(idx);
          }
        }
      },
      { root: container, threshold: [0.6] },
    );

    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-mostaza-deep">
        <IconPhoto
          size={42}
          className="text-crema-deep/50"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide bg-mostaza-deep"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`fotos de ${placeName}`}
      >
        {photos.map((url, i) => (
          <div
            key={url}
            data-slide={i}
            className="relative flex-none w-full h-full snap-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${photos.length}`}
          >
            <Image
              src={url}
              alt={`${placeName} foto ${i + 1}`}
              fill
              sizes="100vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {photos.length > 1 ? (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-[1]"
          aria-hidden="true"
        >
          {photos.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-200",
                i === active ? "w-4 bg-crema-deep" : "w-1.5 bg-crema-deep/50",
              )}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
