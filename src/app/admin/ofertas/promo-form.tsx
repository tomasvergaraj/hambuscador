"use client";

import { useState } from "react";

import { PhotoUploader } from "@/components/place/photo-uploader";
import { Button } from "@/components/ui/button";
import type { DbPromotion, PromotionKind } from "@/server/db/schema";

import { PlacePicker } from "../promociones/place-picker";

const KIND_LABELS: Record<PromotionKind, string> = {
  percent_discount: "% descuento",
  featured_product: "producto destacado",
  combo: "combo",
};

function toLocalInput(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Props =
  | {
      mode: "create";
      action: (formData: FormData) => Promise<void>;
      defaultPlaceId?: string | null;
    }
  | {
      mode: "edit";
      promo: DbPromotion;
      action: (formData: FormData) => Promise<void>;
    };

export function PromoForm(props: Props) {
  const promo = props.mode === "edit" ? props.promo : null;
  const [kind, setKind] = useState<PromotionKind>(
    promo?.kind ?? "percent_discount",
  );
  const [photo, setPhoto] = useState<string[]>(
    promo?.photoUrl ? [promo.photoUrl] : [],
  );
  const defaultStart = promo?.startsAt
    ? toLocalInput(promo.startsAt)
    : toLocalInput(new Date());
  const defaultEnd = promo?.endsAt
    ? toLocalInput(promo.endsAt)
    : toLocalInput(new Date(Date.now() + 30 * 86400 * 1000));

  return (
    <form
      action={props.action}
      className="flex flex-col gap-4 bg-white border border-crema-edge rounded-xl p-4"
    >
      {props.mode === "create" && (
        <div>
          <label className="text-xs font-medium text-carbon mb-1 block">
            local
          </label>
          {props.defaultPlaceId ? (
            <input type="hidden" name="placeId" value={props.defaultPlaceId} />
          ) : (
            <PlacePicker name="placeId" />
          )}
          {props.defaultPlaceId && (
            <p className="text-[11px] text-bronceado">
              local pre-seleccionado desde la edición del place.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="kind" className="text-xs font-medium text-carbon mb-1 block">
          tipo
        </label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as PromotionKind)}
          className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
        >
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="title" className="text-xs font-medium text-carbon mb-1 block">
          título
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          defaultValue={promo?.title ?? ""}
          placeholder="20% OFF en hamburguesas todos los lunes"
          className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="text-xs font-medium text-carbon mb-1 block"
        >
          descripción <span className="text-bronceado">(opcional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={promo?.description ?? ""}
          placeholder="condiciones, exclusiones, etc."
          className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza resize-none"
        />
      </div>

      {kind === "percent_discount" && (
        <div>
          <label
            htmlFor="discountPct"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            % descuento
          </label>
          <input
            id="discountPct"
            name="discountPct"
            type="number"
            min="1"
            max="99"
            required
            defaultValue={promo?.discountPct ?? 20}
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-carbon mb-1 block">
          foto <span className="text-bronceado">(opcional)</span>
        </label>
        <PhotoUploader value={photo} onChange={setPhoto} max={1} />
        <input type="hidden" name="photoUrl" value={photo[0] ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="startsAt"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            inicio
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={defaultStart}
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
        </div>
        <div>
          <label
            htmlFor="endsAt"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            término
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={defaultEnd}
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={promo?.isActive ?? true}
          className="w-4 h-4 accent-mostaza"
        />
        <span className="text-sm text-carbon">activa</span>
      </label>

      <Button type="submit" variant="primary" size="md" fullWidth>
        {props.mode === "create" ? "crear promoción" : "guardar cambios"}
      </Button>
    </form>
  );
}
