"use client";

import * as React from "react";
import { useActionState, useState } from "react";

import { Header } from "@/components/nav/header";
import { PhotoUploader } from "@/components/place/photo-uploader";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ProgressDots } from "@/components/ui/progress-dots";
import { COMUNAS_REGISTRY, CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";

import { createPlaceAction, type CreatePlaceState } from "./actions";

const initial: CreatePlaceState = {};
type Step = 1 | 2 | 3;

export function AgregarWizard() {
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [comunaSlug, setComunaSlug] = useState("");
  const [address, setAddress] = useState("");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hoursWeekdays, setHoursWeekdays] = useState("");
  const [hoursWeekends, setHoursWeekends] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [state, formAction, pending] = useActionState(createPlaceAction, initial);

  const step1Valid =
    name.trim().length >= 2 && comunaSlug.length > 0 && address.trim().length >= 5;
  const step2Valid = cuisines.length > 0 && priceRange.length > 0;
  const canContinue = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

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
      <input type="hidden" name="comunaSlug" value={comunaSlug} />
      <input type="hidden" name="address" value={address} />
      {cuisines.map((c) => (
        <input key={c} type="hidden" name="cuisines" value={c} />
      ))}
      <input type="hidden" name="priceRange" value={priceRange} />
      <input type="hidden" name="specialty" value={specialty} />
      <input type="hidden" name="hoursWeekdays" value={hoursWeekdays} />
      <input type="hidden" name="hoursWeekends" value={hoursWeekends} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="instagram" value={instagram} />
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
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Streat Burger"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="comuna">
              <select
                value={comunaSlug}
                onChange={(e) => setComunaSlug(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">elegí una comuna...</option>
                {COMUNAS_REGISTRY.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="dirección">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ej. Av. Italia 1234"
                className={INPUT_CLS}
              />
              <p className="text-[10px] text-bronceado mt-0.5">
                la ubicación exacta se ajusta al aprobar el local
              </p>
            </Field>
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

            <Field label="horario lunes a viernes (opcional)">
              <input
                type="text"
                value={hoursWeekdays}
                onChange={(e) => setHoursWeekdays(e.target.value)}
                placeholder="ej. 13:00 - 23:00"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="horario sábado y domingo (opcional)">
              <input
                type="text"
                value={hoursWeekends}
                onChange={(e) => setHoursWeekends(e.target.value)}
                placeholder="ej. 13:00 - 00:00"
                className={INPUT_CLS}
              />
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

            <Field label="instagram (opcional)">
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="ej. streatburger (sin @)"
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

        {state.error ? (
          <p
            role="alert"
            className="text-xs text-tomate font-medium bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2 mt-2"
          >
            {state.error}
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
          <Button
            variant="primary"
            size="lg"
            type="button"
            className="flex-[2]"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={!canContinue || pending}
          >
            continuar →
          </Button>
        ) : (
          <Button
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
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] text-bronceado font-medium">{label}</span>
      {children}
    </label>
  );
}
