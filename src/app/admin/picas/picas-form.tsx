"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Chip } from "@/components/ui/chip";
import { CUISINE_TYPES, PRICE_RANGES } from "@/lib/constants";

import type { ActionState } from "./actions";
import { deletePicasListAction } from "./actions";

const ICONS = [
  { id: "sparkles", label: "sparkles" },
  { id: "flame", label: "flame" },
  { id: "leaf", label: "leaf" },
  { id: "coin", label: "coin" },
  { id: "map-pin", label: "map-pin" },
] as const;

export type PicasFormInitial = {
  slug?: string;
  title: string;
  hook: string;
  intro: string;
  icon: string;
  maxItems: number;
  sortOrder: number;
  isActive: boolean;
  criteria: {
    cuisines?: string[];
    priceRanges?: string[];
    comunaSlug?: string;
    regionLabel?: string;
    minRating?: number;
    approvedWithinDays?: number;
    openAfterHour?: string;
  };
};

const initialState: ActionState = { ok: false };

export function PicasForm({
  mode,
  initial,
  action,
}: {
  mode: "create" | "edit";
  initial: PicasFormInitial;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [deleting, startDelete] = useTransition();

  // Estado local para los multi-selects con Chip (los inputs hidden mirroran).
  const [cuisines, setCuisines] = useState<string[]>(initial.criteria.cuisines ?? []);
  const [priceRanges, setPriceRanges] = useState<string[]>(
    initial.criteria.priceRanges ?? [],
  );
  const [icon, setIcon] = useState<string>(initial.icon);
  const [isActive, setIsActive] = useState<boolean>(initial.isActive);

  function toggle(list: string[], setter: (v: string[]) => void, v: string) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-32">
      {/* slug */}
      <Field title="slug (URL)" hint="solo minúsculas, números y guiones. inmutable después de crear.">
        <input
          name="slug"
          required
          minLength={3}
          maxLength={60}
          pattern="[a-z0-9\-]+"
          defaultValue={initial.slug ?? ""}
          disabled={mode === "edit"}
          className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
          placeholder="lo-mejor-de-providencia"
        />
      </Field>

      {/* title */}
      <Field title="título" hint="se ve grande en el hero de la lista.">
        <input
          name="title"
          required
          minLength={2}
          maxLength={60}
          defaultValue={initial.title}
          className={inputCls}
        />
      </Field>

      {/* hook */}
      <Field title="hook" hint="subtítulo corto. va abajo del título y como descripción del OG.">
        <input
          name="hook"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial.hook}
          className={inputCls}
        />
      </Field>

      {/* intro */}
      <Field title="intro" hint="descripción larga que vive arriba del ranking.">
        <textarea
          name="intro"
          required
          minLength={10}
          maxLength={1000}
          defaultValue={initial.intro}
          rows={4}
          className={`${inputCls} resize-y`}
        />
      </Field>

      {/* icon */}
      <Field title="ícono" hint="se usa en el header de la lista + tarjeta del index + OG.">
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <Chip
              key={i.id}
              active={icon === i.id}
              onClick={() => setIcon(i.id)}
            >
              {i.label}
            </Chip>
          ))}
          <input type="hidden" name="icon" value={icon} />
        </div>
      </Field>

      {/* maxItems / sortOrder */}
      <div className="grid grid-cols-2 gap-3">
        <Field title="máx ítems" hint="cuántos locales mostrar.">
          <input
            type="number"
            name="maxItems"
            min={1}
            max={50}
            defaultValue={initial.maxItems}
            className={inputCls}
          />
        </Field>
        <Field title="orden" hint="menor = primero en /picas.">
          <input
            type="number"
            name="sortOrder"
            min={0}
            max={10000}
            defaultValue={initial.sortOrder}
            className={inputCls}
          />
        </Field>
      </div>

      {/* active */}
      <Field title="activa" hint="si está apagada, se oculta de /picas y del sitemap.">
        <label className="inline-flex items-center gap-2 text-sm text-carbon">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4"
          />
          mostrar al público
        </label>
      </Field>

      {/* CRITERIA */}
      <fieldset className="mt-2 bg-crema-deep border border-crema-edge rounded-xl p-4 flex flex-col gap-4">
        <legend className="font-display font-semibold text-sm text-carbon px-1">
          filtros (criteria)
        </legend>

        <Field title="cocinas" hint="OR — la lista incluye locales con CUALQUIERA de estas cocinas.">
          <div className="flex flex-wrap gap-2">
            {CUISINE_TYPES.map((c) => (
              <Chip
                key={c.id}
                active={cuisines.includes(c.id)}
                onClick={() => toggle(cuisines, setCuisines, c.id)}
              >
                {c.label}
              </Chip>
            ))}
            <input
              type="hidden"
              name="criteria_cuisines"
              value={cuisines.join(",")}
            />
          </div>
        </Field>

        <Field title="precios" hint="OR — la lista incluye locales en CUALQUIERA de estos rangos.">
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((p) => (
              <Chip
                key={p.id}
                active={priceRanges.includes(p.id)}
                onClick={() => toggle(priceRanges, setPriceRanges, p.id)}
              >
                {p.label}
              </Chip>
            ))}
            <input
              type="hidden"
              name="criteria_priceRanges"
              value={priceRanges.join(",")}
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field title="slug de comuna" hint='ej. "providencia". match exacto.'>
            <input
              name="criteria_comunaSlug"
              defaultValue={initial.criteria.comunaSlug ?? ""}
              className={inputCls}
              placeholder=""
            />
          </Field>
          <Field title="label de región" hint='ej. "Región Metropolitana". match exacto.'>
            <input
              name="criteria_regionLabel"
              defaultValue={initial.criteria.regionLabel ?? ""}
              className={inputCls}
              placeholder=""
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field title="rating mínimo" hint="bayes ≥ X. ej. 4.0">
            <input
              type="number"
              name="criteria_minRating"
              min={0}
              max={5}
              step={0.1}
              defaultValue={initial.criteria.minRating ?? ""}
              className={inputCls}
            />
          </Field>
          <Field title="aprobado últ. N días" hint="ej. 60 → últimos 2 meses.">
            <input
              type="number"
              name="criteria_approvedWithinDays"
              min={1}
              max={3650}
              step={1}
              defaultValue={initial.criteria.approvedWithinDays ?? ""}
              className={inputCls}
            />
          </Field>
          <Field title="cierra desde" hint='HH:MM. ej. "23:00".'>
            <input
              type="text"
              name="criteria_openAfterHour"
              pattern="\d{2}:\d{2}"
              defaultValue={initial.criteria.openAfterHour ?? ""}
              className={inputCls}
              placeholder="23:00"
            />
          </Field>
        </div>
      </fieldset>

      {state.error ? (
        <div className="bg-tomate/10 border border-tomate/30 text-tomate text-xs rounded-md p-3">
          {state.error}
        </div>
      ) : state.ok && mode === "edit" ? (
        <div className="bg-lechuga/10 border border-lechuga/30 text-lechuga text-xs rounded-md p-3">
          cambios guardados.
        </div>
      ) : null}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge p-3 flex gap-2 z-10">
        <div className="max-w-3xl mx-auto w-full flex gap-2 items-center">
          {mode === "edit" && initial.slug ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (
                  window.confirm(
                    `borrar la lista "${initial.title}"? esta acción no se puede deshacer.`,
                  )
                ) {
                  startDelete(async () => {
                    await deletePicasListAction(initial.slug!);
                    router.push("/admin/picas");
                  });
                }
              }}
              className="text-xs text-tomate font-medium px-3 py-2 rounded-md hover:bg-tomate/10 transition-colors disabled:opacity-50"
            >
              {deleting ? "borrando…" : "borrar"}
            </button>
          ) : null}
          <div className="flex-1" />
          <button
            type="submit"
            disabled={pending}
            className="bg-mostaza hover:bg-mostaza-deep text-carbon font-semibold text-sm px-5 py-2 rounded-full transition-[transform,colors] active:scale-95 disabled:opacity-50"
          >
            {pending
              ? "guardando…"
              : mode === "create"
                ? "crear lista"
                : "guardar cambios"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCls =
  "w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado focus:outline-none focus:border-mostaza transition-colors";

function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="font-display font-semibold text-xs text-carbon">
          {title}
        </span>
        {hint ? (
          <span className="block text-[11px] text-tinta-suave mt-0.5">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
