"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";

import {
  DaysSchedule,
  deserializeSchedule,
  serializeSchedule,
  summarizeWeekdays,
  summarizeWeekends,
  type ScheduleValue,
} from "@/components/place/days-schedule";
import { PhotoUploader } from "@/components/place/photo-uploader";
import { PinPickerMap } from "@/components/place/pin-picker-map";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Place } from "@/types/place";

import { updatePlaceAction, type UpdatePlaceState } from "./actions";

type Toast = { kind: "ok" | "error"; msg: string };

const initial: UpdatePlaceState = {};

export function EditPlaceForm({ place }: { place: Place }) {
  // Bind del placeId para que el action lo reciba como primer arg.
  const boundAction = updatePlaceAction.bind(null, place.id);
  const [state, formAction, pending] = useActionState(boundAction, initial);

  const [name, setName] = useState(place.name);
  const [comunaLabel, setComunaLabel] = useState(place.comunaLabel);
  const [region, setRegion] = useState(place.region);
  const [address, setAddress] = useState(place.address);
  const [lat, setLat] = useState<number>(place.coords.lat);
  const [lng, setLng] = useState<number>(place.coords.lng);
  const [cuisines, setCuisines] = useState<string[]>(place.cuisines);
  const [priceRange, setPriceRange] = useState<string>(place.priceRange);
  const [specialty, setSpecialty] = useState(place.specialty ?? "");
  const [schedule, setSchedule] = useState<ScheduleValue>(() =>
    deserializeSchedule(place.hours.byDay),
  );
  const [phone, setPhone] = useState(place.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(place.whatsapp ?? "");
  const [instagram, setInstagram] = useState(place.instagram ?? "");
  const [website, setWebsite] = useState(place.website ?? "");
  const [photos, setPhotos] = useState<string[]>(place.photos);
  const [isVerified, setIsVerified] = useState<boolean>(place.isVerified);
  const [isFeatured, setIsFeatured] = useState<boolean>(place.isFeatured);

  // Toast — re-trigger por cada nuevo state que devuelve el action
  // (useActionState produce nuevo objeto en cada submit, así el effect dispara
  // aunque dos saves consecutivos den ok). El key fuerza remount → animación
  // de entrada se replay.
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    if (state?.ok) {
      setToast({ kind: "ok", msg: "cambios guardados" });
      setToastKey((k) => k + 1);
    } else if (state?.error) {
      setToast({ kind: "error", msg: state.error });
      setToastKey((k) => k + 1);
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.kind === "ok" ? 2500 : 5000;
    const id = window.setTimeout(() => setToast(null), ms);
    return () => window.clearTimeout(id);
  }, [toast, toastKey]);

  const hoursByDayJson = JSON.stringify(serializeSchedule(schedule));
  const hoursWeekdays = summarizeWeekdays(schedule);
  const hoursWeekends = summarizeWeekends(schedule);

  function toggleCuisine(id: string) {
    setCuisines((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Bloque: identidad */}
      <Section title="identidad">
        <Field label="nombre">
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="comuna (display)">
            <input
              type="text"
              name="comunaLabel"
              value={comunaLabel}
              onChange={(e) => setComunaLabel(e.target.value)}
              required
              className={inputCls}
            />
            <p className="text-[10px] text-bronceado mt-1">
              el slug de URL queda fijo: <code>{place.comuna}</code>
            </p>
          </Field>
          <Field label="región">
            <input
              type="text"
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Bloque: ubicación */}
      <Section title="ubicación">
        <Field label="dirección">
          <input
            type="text"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <div className="rounded-xl overflow-hidden border border-crema-edge">
          <PinPickerMap
            lat={lat}
            lng={lng}
            onChange={(la, ln) => {
              setLat(la);
              setLng(ln);
            }}
          />
        </div>
        <input type="hidden" name="lat" value={lat} />
        <input type="hidden" name="lng" value={lng} />
        <p className="text-[11px] text-bronceado">
          arrastra el pin para ajustar las coordenadas si la dirección es ambigua
        </p>
      </Section>

      {/* Bloque: clasificación */}
      <Section title="clasificación">
        <Field label="cocinas (al menos una)">
          <div className="flex flex-wrap gap-1.5">
            {CUISINE_TYPES.map((c) => (
              <Chip
                key={c.id}
                active={cuisines.includes(c.id)}
                onClick={() => toggleCuisine(c.id)}
                aria-pressed={cuisines.includes(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          {cuisines.map((c) => (
            <input key={c} type="hidden" name="cuisines" value={c} />
          ))}
        </Field>

        <Field label="rango de precio">
          <div className="flex flex-wrap gap-1.5">
            {PRICE_RANGES.map((p) => (
              <Chip
                key={p.id}
                active={priceRange === p.id}
                onClick={() => setPriceRange(p.id)}
                aria-pressed={priceRange === p.id}
              >
                {p.label}
                <span className="text-[10px] text-bronceado ml-1">
                  {p.description}
                </span>
              </Chip>
            ))}
          </div>
          <input type="hidden" name="priceRange" value={priceRange} />
        </Field>

        <Field label="especialidad (opcional)">
          <input
            type="text"
            name="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="ej. smash doble con tocino"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Bloque: horario */}
      <Section title="horario">
        <DaysSchedule value={schedule} onChange={setSchedule} />
        <input type="hidden" name="hoursByDay" value={hoursByDayJson} />
        <input type="hidden" name="hoursWeekdays" value={hoursWeekdays} />
        <input type="hidden" name="hoursWeekends" value={hoursWeekends} />
      </Section>

      {/* Bloque: contacto */}
      <Section title="contacto (opcional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="teléfono">
            <input
              type="text"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 2 1234 5678"
              className={inputCls}
            />
          </Field>
          <Field label="whatsapp">
            <input
              type="text"
              name="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+56 9 1234 5678"
              className={inputCls}
            />
          </Field>
          <Field label="instagram">
            <input
              type="text"
              name="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="usuario sin @"
              className={inputCls}
            />
          </Field>
          <Field label="sitio web">
            <input
              type="url"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://ejemplo.cl"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Bloque: fotos */}
      <Section title="fotos (máx 6)">
        <PhotoUploader value={photos} onChange={setPhotos} max={6} />
        {photos.map((url, i) => (
          <input key={i} type="hidden" name="photos" value={url} />
        ))}
      </Section>

      {/* Bloque: flags admin */}
      <Section title="flags">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="isVerified"
            checked={isVerified}
            onChange={(e) => setIsVerified(e.target.checked)}
            className="w-4 h-4 accent-mostaza"
          />
          <span className="text-sm text-carbon">marcar como verificado</span>
        </label>
        <p className="text-[11px] text-bronceado">
          el badge «verificado» aparece en la ficha y la card. úsalo para locales
          revisados manualmente.
        </p>

        <label className="inline-flex items-center gap-2 cursor-pointer mt-2">
          <input
            type="checkbox"
            name="isFeatured"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="w-4 h-4 accent-mostaza"
          />
          <span className="text-sm text-carbon">destacado (publicidad)</span>
        </label>
        <p className="text-[11px] text-bronceado">
          el local sale con pin diferenciado en el mapa. úsalo solo para locales
          con publicidad activa.
        </p>
      </Section>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-crema border-t border-crema-edge flex gap-2 justify-end">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "guardando..." : "guardar cambios"}
        </Button>
      </div>

      {toast ? (
        <div
          key={toastKey}
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50",
            "flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border font-medium text-sm",
            "animate-[slideUp_0.25s_ease-out]",
            toast.kind === "ok"
              ? "bg-lechuga text-crema-deep border-lechuga-deep"
              : "bg-tomate text-crema-deep border-tomate-deep",
          )}
        >
          {toast.kind === "ok" ? (
            <IconCheck size={18} aria-hidden="true" />
          ) : (
            <IconAlertCircle size={18} aria-hidden="true" />
          )}
          <span className="flex-1">{toast.msg}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="cerrar aviso"
            className="text-crema-deep/80 hover:text-crema-deep transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      ) : null}
    </form>
  );
}

const inputCls =
  "w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado focus:outline-none focus:border-mostaza transition-colors";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-crema-edge rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-display font-semibold text-sm text-carbon">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-tinta-suave font-medium">{label}</span>
      {children}
    </div>
  );
}
