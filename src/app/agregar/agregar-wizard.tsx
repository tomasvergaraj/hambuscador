"use client";

import * as React from "react";
import { useActionState, useState } from "react";

import { Header } from "@/components/nav/header";
import { AddressAutocomplete } from "@/components/place/address-autocomplete";
import { ComunaAutocomplete } from "@/components/place/comuna-autocomplete";
import {
  DEFAULT_SCHEDULE,
  DaysSchedule,
  serializeSchedule,
  summarizeWeekdays,
  summarizeWeekends,
  type ScheduleValue,
} from "@/components/place/days-schedule";
import { PhotoUploader } from "@/components/place/photo-uploader";
import { PinPickerMap } from "@/components/place/pin-picker-map";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ProgressDots } from "@/components/ui/progress-dots";
import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Comuna } from "@/server/services/comunas";

import {
  checkPlaceExistsAction,
  createPlaceAction,
  type CreatePlaceState,
} from "./actions";

const initial: CreatePlaceState = {};
type Step = 1 | 2 | 3;

export function AgregarWizard({ comunas }: { comunas: Comuna[] }) {
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [comuna, setComuna] = useState<Comuna | null>(null);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  // Validación step 1 → 2: chequea duplicado nombre+comuna en DB
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [state, formAction, pending] = useActionState(createPlaceAction, initial);

  const hoursByDayJson = JSON.stringify(serializeSchedule(schedule));
  const hoursWeekdays = summarizeWeekdays(schedule);
  const hoursWeekends = summarizeWeekends(schedule);

  // Sesgo geográfico para el autocomplete: centroide de la comuna seleccionada
  const bias = comuna ? { lat: comuna.lat, lng: comuna.lng } : undefined;

  const hasCoords = lat !== null && lng !== null;
  const step1Valid =
    name.trim().length >= 2 && comuna !== null && address.trim().length >= 5 && hasCoords;
  const step2Valid = cuisines.length > 0 && priceRange.length > 0;
  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

  async function handleContinue() {
    if (step === 1) {
      setStep1Error(null);
      if (!comuna) return;
      setCheckingDup(true);
      try {
        const { exists } = await checkPlaceExistsAction({
          name: name.trim(),
          comunaSlug: comuna.slug,
        });
        if (exists) {
          setStep1Error(
            "Ya existe un local con ese nombre en esa comuna. Intenta uno más específico.",
          );
          return;
        }
      } catch {
        // Si falla la verificación, igual permitimos avanzar — el unique
        // constraint del INSERT bloquea al final si el caso era real.
      } finally {
        setCheckingDup(false);
      }
    }
    setStep((s) => ((s + 1) as Step));
  }

  const stepTitle =
    step === 1
      ? "¿qué picá nos quieres mostrar?"
      : step === 2
        ? "cuéntanos los detalles"
        : "fotos y contacto (opcional)";

  function toggleCuisine(id: string) {
    setCuisines((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  return (
    <form action={formAction} className="flex flex-col min-h-screen pb-24">
      {/* Hidden inputs que mirroran el state — todos van al action sin importar el paso visible */}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="comunaSlug" value={comuna?.slug ?? ""} />
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />
      {cuisines.map((c) => (
        <input key={c} type="hidden" name="cuisines" value={c} />
      ))}
      <input type="hidden" name="priceRange" value={priceRange} />
      <input type="hidden" name="specialty" value={specialty} />
      <input type="hidden" name="hoursWeekdays" value={hoursWeekdays} />
      <input type="hidden" name="hoursWeekends" value={hoursWeekends} />
      <input type="hidden" name="hoursByDay" value={hoursByDayJson} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="whatsapp" value={whatsapp} />
      <input type="hidden" name="instagram" value={instagram} />
      <input type="hidden" name="website" value={website} />
      {photos.map((url) => (
        <input key={url} type="hidden" name="photos" value={url} />
      ))}

      <Header title="agregar lugar" isModal />

      <div className="px-4 pt-4">
        <ProgressDots total={3} current={step} className="mb-3" />
        <p className="text-[10px] text-bronceado tracking-widest font-medium">
          PASO {step} DE 3
        </p>
        <h1 className="font-display font-semibold text-xl text-carbon mt-1 tracking-tight">
          {stepTitle}
        </h1>
      </div>

      <main className="px-4 pt-6 flex-1 flex flex-col gap-3">
        {step === 1 ? (
          <>
            <Field label="nombre del local">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (step1Error) setStep1Error(null);
                }}
                placeholder="ej. Streat Burger"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="comuna">
              <ComunaAutocomplete
                comunas={comunas}
                value={comuna}
                onChange={(c) => {
                  setComuna(c);
                  if (step1Error) setStep1Error(null);
                  // Si cambió la comuna, invalidamos las coords del local
                  // para forzar a re-elegir dirección dentro de la comuna nueva.
                  if (hasCoords) {
                    setLat(null);
                    setLng(null);
                  }
                }}
              />
            </Field>

            <Field label="dirección">
              <AddressAutocomplete
                value={address}
                onChange={(text) => {
                  setAddress(text);
                  // Si el usuario edita el texto manualmente después de
                  // haber elegido una sugerencia, invalidamos las coords
                  // para forzar un nuevo pin.
                  if (hasCoords) {
                    setLat(null);
                    setLng(null);
                  }
                }}
                onSelectLocation={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                }}
                bias={bias}
                placeholder="ej. Av. Italia 1234"
              />
              {!hasCoords ? (
                <p className="text-[10px] text-bronceado mt-0.5">
                  escribe al menos 4 letras y elige una de las sugerencias
                </p>
              ) : null}
            </Field>

            {hasCoords && lat !== null && lng !== null ? (
              <Field label="ajusta el pin si está corrido">
                <PinPickerMap
                  lat={lat}
                  lng={lng}
                  onChange={(la, ln) => {
                    setLat(la);
                    setLng(ln);
                  }}
                />
                <p className="text-[10px] text-bronceado mt-0.5">
                  arrastra el pin para corregir la ubicación
                </p>
              </Field>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="tipo de cocina (uno o más)">
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_TYPES.map((c) => (
                  <Chip
                    key={c.id}
                    active={cuisines.includes(c.id)}
                    onClick={() => toggleCuisine(c.id)}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="rango de precio por persona">
              <div className="flex gap-1.5">
                {PRICE_RANGES.map((p) => (
                  <Chip
                    key={p.id}
                    active={priceRange === p.id}
                    onClick={() => setPriceRange(p.id)}
                    aria-label={`${p.label} — ${p.description}`}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-bronceado">
                {PRICE_RANGES.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-baseline gap-1.5",
                      priceRange === p.id && "text-carbon font-medium",
                    )}
                  >
                    <span className="font-mono">{p.label}</span>
                    <span>{p.description}</span>
                  </li>
                ))}
              </ul>
            </Field>

            <Field label="especialidad (opcional)">
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="ej. smash doble con tocino"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="horario por día (opcional)">
              <DaysSchedule value={schedule} onChange={setSchedule} />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Field label="fotos">
              <PhotoUploader value={photos} onChange={setPhotos} max={4} />
            </Field>

            <Field label="teléfono (opcional)">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ej. +56 9 1234 5678"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="whatsapp (opcional)">
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="ej. +56 9 1234 5678"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="instagram (opcional)">
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="ej. streatburger (sin @)"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="sitio web (opcional)">
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="ej. https://streatburger.cl"
                className={INPUT_CLS}
              />
            </Field>

            <div className="rounded-md bg-crema-deep border border-crema-edge p-4 text-center mt-2">
              <p className="text-xs text-tinta-suave leading-relaxed">
                la ficha queda en revisión. te avisamos cuando se apruebe.
              </p>
            </div>
          </>
        ) : null}

        {state.error || step1Error ? (
          <p
            role="alert"
            className="text-xs text-tomate font-medium bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2 mt-2"
          >
            {state.error ?? step1Error}
          </p>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge px-4 py-3 z-30 flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          type="button"
          className="flex-1"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || pending}
        >
          atrás
        </Button>
        {step < 3 ? (
          // Key distinto para forzar a React a montar otro DOM node cuando
          // pasamos al paso final — sino el cambio de type="button" →
          // type="submit" en el mismo <button> hace que el click pendiente
          // se propague como submit y se salte el paso 3.
          <Button
            key="next"
            variant="primary"
            size="lg"
            type="button"
            className="flex-[2]"
            onClick={handleContinue}
            disabled={!canContinue || pending || checkingDup}
          >
            {checkingDup ? "verificando…" : "continuar →"}
          </Button>
        ) : (
          <Button
            key="submit"
            variant="primary"
            size="lg"
            type="submit"
            className="flex-[2]"
            disabled={pending}
          >
            {pending ? "publicando…" : "publicar →"}
          </Button>
        )}
      </div>
    </form>
  );
}

const INPUT_CLS =
  "w-full bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // No usamos <label> acá: muchos Fields contienen varios inputs (chips,
  // switches, time pickers) y un <label> que envuelve N inputs se asocia
  // implícitamente con el PRIMER form control descendiente, haciendo que
  // un click en cualquier parte del Field active ese primer control.
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-bronceado font-medium">{label}</span>
      {children}
    </div>
  );
}
