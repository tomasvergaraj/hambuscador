import {
  IconCheck,
  IconClock,
  IconMapPin,
  IconPhone,
  IconBrandInstagram,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { getPendingPlaces } from "@/server/services/places";
import type { Place } from "@/types/place";

import { approveAction, rejectAction } from "./actions";

export const metadata = {
  title: "moderación",
};

// No cachear — el panel admin tiene que ver el estado fresco
export const dynamic = "force-dynamic";

const cuisineLabel = new Map(CUISINE_TYPES.map((c) => [c.id, c.label]));
const priceLabel = new Map(PRICE_RANGES.map((p) => [p.id, p.label]));

export default async function ModeracionPage() {
  const pending = await getPendingPlaces();

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display font-semibold text-xl text-carbon">
          panel de moderación
        </h1>
        <span className="text-xs text-tinta-suave">
          {pending.length} {pending.length === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      {pending.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((place) => (
            <li key={place.id}>
              <PendingPlaceCard place={place} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function PendingPlaceCard({ place }: { place: Place }) {
  return (
    <article className="bg-white border border-crema-edge rounded-xl p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-base text-carbon">{place.name}</h2>
          <p className="text-[11px] text-bronceado">
            /{place.comuna}/{place.slug}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-medium text-mostaza-deep bg-mostaza/15 px-2 py-1 rounded">
          pending
        </span>
      </header>

      <dl className="mt-3 flex flex-col gap-1.5 text-xs text-carbon">
        <Field icon={<IconMapPin size={14} />} label="ubicación">
          {place.address} · {place.comunaLabel}, {place.region}
        </Field>

        <Field label="cocina + precio">
          {place.cuisines.map((c) => cuisineLabel.get(c) ?? c).join(", ")}
          {" · "}
          {priceLabel.get(place.priceRange) ?? place.priceRange}
        </Field>

        {place.specialty ? (
          <Field label="especialidad">{place.specialty}</Field>
        ) : null}

        {place.hours.weekdays || place.hours.weekends ? (
          <Field icon={<IconClock size={14} />} label="horario">
            {place.hours.weekdays ? `L-V: ${place.hours.weekdays}` : null}
            {place.hours.weekdays && place.hours.weekends ? "  ·  " : null}
            {place.hours.weekends ? `S-D: ${place.hours.weekends}` : null}
          </Field>
        ) : null}

        {place.phone ? (
          <Field icon={<IconPhone size={14} />} label="teléfono">
            {place.phone}
          </Field>
        ) : null}

        {place.instagram ? (
          <Field icon={<IconBrandInstagram size={14} />} label="instagram">
            @{place.instagram}
          </Field>
        ) : null}
      </dl>

      <footer className="mt-4 flex gap-2">
        <form action={rejectAction} className="flex-1">
          <input type="hidden" name="placeId" value={place.id} />
          <Button variant="secondary" size="md" fullWidth type="submit">
            <IconX size={14} aria-hidden="true" /> rechazar
          </Button>
        </form>
        <form action={approveAction} className="flex-[2]">
          <input type="hidden" name="placeId" value={place.id} />
          <Button variant="primary" size="md" fullWidth type="submit">
            <IconCheck size={14} aria-hidden="true" /> aprobar
          </Button>
        </form>
      </footer>
    </article>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-bronceado mt-px shrink-0">{icon ?? <span className="w-3.5 inline-block" />}</span>
      <span>
        <span className="text-bronceado mr-1">{label}:</span>
        {children}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
      <p className="font-display font-semibold text-base text-carbon">
        no hay nada pendiente
      </p>
      <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
        cuando alguien agregue una hamburguesería, aparece acá esperando aprobación.
      </p>
    </div>
  );
}
