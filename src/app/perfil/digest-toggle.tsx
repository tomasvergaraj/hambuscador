"use client";

import { IconMail, IconMailCheck, IconMailOff } from "@tabler/icons-react";
import * as React from "react";

import { setDigestFrequencyAction } from "./actions";

type Frequency = "off" | "daily" | "weekly";

const OPTIONS: Array<{ value: Frequency; label: string; sub: string }> = [
  { value: "off", label: "desactivado", sub: "no recibo emails" },
  { value: "daily", label: "diario", sub: "un email al día con lo nuevo" },
  { value: "weekly", label: "semanal", sub: "los lunes, el resumen de la semana" },
];

type Props = {
  initial: Frequency;
};

/**
 * Selector de frecuencia del email digest. El email se manda solo si el
 * usuario tiene novedades pendientes — nunca se envía un digest vacío.
 *
 * UX: 3 botones radio-like. Click cambia el estado optimistic + dispara la
 * server action. Si falla, revierte y muestra el error.
 */
export function DigestToggle({ initial }: Props) {
  const [value, setValue] = React.useState<Frequency>(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function pick(next: Frequency) {
    if (next === value || pending) return;
    const prev = value;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const res = await setDigestFrequencyAction(next);
      if (!res.ok) {
        setValue(prev);
        setError(res.error ?? "no pudimos guardar");
      }
    });
  }

  const Icon =
    value === "off" ? IconMailOff : value === "daily" ? IconMailCheck : IconMail;
  const headlineLabel =
    value === "off"
      ? "sin emails"
      : value === "daily"
        ? "diario"
        : "semanal";

  return (
    <section className="bg-crema-deep border border-crema-edge rounded-lg p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-md bg-mostaza/15 text-mostaza-deep flex items-center justify-center shrink-0">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-carbon">resumen por mail</p>
          <p className="text-[11px] text-bronceado">{headlineLabel}</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="frecuencia del resumen por mail"
        className="grid grid-cols-3 gap-1.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => pick(opt.value)}
              className={
                "rounded-md px-2 py-2 text-left transition-[transform,colors] duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed " +
                (active
                  ? "bg-carbon text-crema"
                  : "bg-white border border-crema-edge text-carbon hover:border-mostaza/50")
              }
            >
              <span className="text-xs font-medium block">{opt.label}</span>
              <span
                className={
                  "text-[10px] leading-tight block " +
                  (active ? "text-crema-edge" : "text-bronceado")
                }
              >
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-tomate" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
