"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { DbBrand } from "@/server/db/schema";

import { BrandLogoPicker } from "./brand-logo-picker";

type Props =
  | { mode: "create"; action: (formData: FormData) => Promise<void> }
  | {
      mode: "edit";
      brand: DbBrand;
      action: (formData: FormData) => Promise<void>;
    };

export function BrandForm(props: Props) {
  const brand = props.mode === "edit" ? props.brand : null;
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logoUrl ?? null);

  return (
    <form
      action={props.action}
      className="flex flex-col gap-4 bg-white border border-crema-edge rounded-xl p-4"
    >
      <div>
        <label className="text-xs font-medium text-carbon mb-1 block">
          logo
        </label>
        <BrandLogoPicker value={logoUrl} onChange={setLogoUrl} />
        <input type="hidden" name="logoUrl" value={logoUrl ?? ""} />
        <p className="text-[11px] text-bronceado mt-2">
          subes la imagen y elegís qué parte sale dentro del pin con
          drag/zoom. Logos cuadrados con fondo claro lucen mejor.
        </p>
      </div>

      {props.mode === "create" && (
        <div>
          <label
            htmlFor="slug"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            pattern="[a-z0-9](?:[a-z0-9\-]{0,48}[a-z0-9])?"
            placeholder="burger-king"
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
          <p className="text-[11px] text-bronceado mt-1">
            ASCII kebab-case. Inmutable después de crear.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="text-xs font-medium text-carbon mb-1 block"
        >
          nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={brand?.name ?? ""}
          placeholder="Burger King"
          className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="color"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            color hex <span className="text-bronceado">(opcional)</span>
          </label>
          <input
            id="color"
            name="color"
            type="text"
            pattern="#[0-9a-fA-F]{6}"
            maxLength={7}
            defaultValue={brand?.color ?? ""}
            placeholder="#E31837"
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza font-mono"
          />
        </div>
        <div>
          <label
            htmlFor="website"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            sitio web <span className="text-bronceado">(opcional)</span>
          </label>
          <input
            id="website"
            name="website"
            type="url"
            defaultValue={brand?.website ?? ""}
            placeholder="https://burgerking.cl"
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
        </div>
      </div>

      {props.mode === "edit" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={brand?.isActive ?? true}
            className="w-4 h-4 accent-mostaza"
          />
          <span className="text-sm text-carbon">brand activa</span>
        </label>
      )}

      <Button type="submit" variant="primary" size="md" fullWidth>
        {props.mode === "create" ? "crear cadena" : "guardar cambios"}
      </Button>
    </form>
  );
}
