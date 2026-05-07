"use client";

import type { Dispatch, SetStateAction } from "react";

import { DAY_FULL_LABEL, DAY_KEYS, DAY_LABEL, type DayKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ============================================================================
// DaysSchedule — fila por día con switch (abierto/cerrado) + dos inputs de
// hora cuando está abierto. El padre maneja el state.
//
// Shape del valor:
//   Record<DayKey, { open: boolean; from: string; to: string }>
//
// `from`/`to` son strings "HH:MM" (formato de <input type="time">). Cuando
// `open=false`, los strings se conservan (para no perder lo tipeado al
// togglear), pero serializeSchedule() los descarta.
// ============================================================================

export type DaySlot = { open: boolean; from: string; to: string };
export type ScheduleValue = Record<DayKey, DaySlot>;

export const DEFAULT_SCHEDULE: ScheduleValue = {
  lun: { open: false, from: "13:00", to: "23:00" },
  mar: { open: false, from: "13:00", to: "23:00" },
  mie: { open: false, from: "13:00", to: "23:00" },
  jue: { open: false, from: "13:00", to: "23:00" },
  vie: { open: false, from: "13:00", to: "23:00" },
  sab: { open: false, from: "13:00", to: "23:00" },
  dom: { open: false, from: "13:00", to: "23:00" },
};

type Props = {
  value: ScheduleValue;
  /**
   * Aceptamos directamente el setter de useState — usamos updater funcional
   * para evitar stale closures cuando el usuario interactúa con varios días
   * antes que React re-renderee (ej. clicks rápidos en switches distintos).
   */
  onChange: Dispatch<SetStateAction<ScheduleValue>>;
};

export function DaysSchedule({ value, onChange }: Props) {
  function update(day: DayKey, patch: Partial<DaySlot>) {
    onChange((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {DAY_KEYS.map((d) => (
        <DayRow
          key={d}
          day={d}
          slot={value[d]}
          onToggle={() => update(d, { open: !value[d].open })}
          onChangeFrom={(v) => update(d, { from: v })}
          onChangeTo={(v) => update(d, { to: v })}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Una fila por día. Cada `DayRow` tiene su propio scope de closures — así no
// hay forma de que un click en otra fila accidentalmente toque la fila de
// lunes (defensivo contra bugs de reconciliación).
// ----------------------------------------------------------------------------

function DayRow({
  day,
  slot,
  onToggle,
  onChangeFrom,
  onChangeTo,
}: {
  day: DayKey;
  slot: DaySlot;
  onToggle: () => void;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-crema-deep border border-crema-edge rounded-md px-3 py-2">
      <label
        className="inline-flex items-center gap-2 cursor-pointer select-none"
        aria-label={`${DAY_FULL_LABEL[day]} ${slot.open ? "abierto" : "cerrado"}`}
      >
        <input
          type="checkbox"
          checked={slot.open}
          onChange={onToggle}
          className="sr-only peer"
        />
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            slot.open ? "bg-mostaza" : "bg-crema-edge",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              slot.open ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </span>
        <span className="text-xs font-medium text-carbon w-9">{DAY_LABEL[day]}</span>
      </label>
      {slot.open ? (
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          <input
            type="time"
            value={slot.from}
            onChange={(e) => onChangeFrom(e.target.value)}
            className="bg-white border border-crema-edge rounded px-2 py-1 text-xs text-carbon outline-none focus:border-bronceado w-[5.5rem]"
          />
          <span className="text-xs text-bronceado">–</span>
          <input
            type="time"
            value={slot.to}
            onChange={(e) => onChangeTo(e.target.value)}
            className="bg-white border border-crema-edge rounded px-2 py-1 text-xs text-carbon outline-none focus:border-bronceado w-[5.5rem]"
          />
        </div>
      ) : (
        <span className="text-xs text-bronceado flex-1 text-right">cerrado</span>
      )}
    </div>
  );
}

/**
 * Convierte el state del componente al formato de la columna `hours_by_day`
 * de la DB: cada día → "HH:MM-HH:MM" o `null` si está cerrado / inválido.
 */
export function serializeSchedule(value: ScheduleValue): Record<DayKey, string | null> {
  const out = {} as Record<DayKey, string | null>;
  for (const d of DAY_KEYS) {
    const slot = value[d];
    if (!slot.open) {
      out[d] = null;
      continue;
    }
    if (!isHHMM(slot.from) || !isHHMM(slot.to)) {
      out[d] = null;
      continue;
    }
    out[d] = `${slot.from}-${slot.to}`;
  }
  return out;
}

/**
 * Resumen legible para los campos legacy `hours_weekdays` / `hours_weekends`.
 * Si todos los días de un grupo tienen el mismo horario, retorna ese horario;
 * si hay variación, retorna "ver por día"; si todos cerrados, "cerrado".
 */
export function summarizeWeekdays(value: ScheduleValue): string {
  return summarizeGroup(value, ["lun", "mar", "mie", "jue", "vie"]);
}
export function summarizeWeekends(value: ScheduleValue): string {
  return summarizeGroup(value, ["sab", "dom"]);
}

function summarizeGroup(value: ScheduleValue, days: DayKey[]): string {
  const slots = days.map((d) => value[d]);
  const allClosed = slots.every((s) => !s.open);
  if (allClosed) return "cerrado";
  const ranges = slots
    .filter((s) => s.open && isHHMM(s.from) && isHHMM(s.to))
    .map((s) => `${s.from}-${s.to}`);
  const unique = Array.from(new Set(ranges));
  if (unique.length === 1) return unique[0] ?? "";
  return "ver por día";
}

function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
