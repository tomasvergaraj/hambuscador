"use client";

import { useState } from "react";

import { PlacePicker } from "./place-picker";

type BrandOption = { id: string; name: string; slug: string };

/**
 * Selector de target: place vs brand. Para place usa PlacePicker (autocomplete
 * via /api/search/suggest). Para brand muestra <select> con todas las brands
 * activas (catálogo chico, no necesita autocomplete).
 *
 * Emite hidden `placeId` o `brandId` según selección. El action server lee
 * cualquiera de los dos (exactly-one constraint).
 */
export function TargetSelector({ brands }: { brands: BrandOption[] }) {
  const [type, setType] = useState<"place" | "brand">("place");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 cursor-pointer bg-crema-deep border border-crema-edge rounded-md p-3 hover:border-mostaza">
          <input
            type="radio"
            name="targetType"
            value="place"
            checked={type === "place"}
            onChange={() => setType("place")}
            className="accent-mostaza"
          />
          <div>
            <p className="text-sm font-medium text-carbon">local</p>
            <p className="text-[11px] text-bronceado">una hamburguesería específica</p>
          </div>
        </label>
        <label className="flex-1 flex items-center gap-2 cursor-pointer bg-crema-deep border border-crema-edge rounded-md p-3 hover:border-mostaza">
          <input
            type="radio"
            name="targetType"
            value="brand"
            checked={type === "brand"}
            onChange={() => setType("brand")}
            className="accent-mostaza"
          />
          <div>
            <p className="text-sm font-medium text-carbon">cadena</p>
            <p className="text-[11px] text-bronceado">todos los locales de la marca</p>
          </div>
        </label>
      </div>

      {type === "place" ? (
        <PlacePicker name="placeId" />
      ) : (
        <select
          name="brandId"
          required
          defaultValue=""
          className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
        >
          <option value="" disabled>
            elige una cadena…
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
