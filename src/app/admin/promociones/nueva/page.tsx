import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAllBrands } from "@/server/services/brands";

import { createSubscriptionAction } from "../actions";
import { TargetSelector } from "../target-selector";

export const metadata = { title: "admin · nueva promoción" };

export default async function NuevaPromocionPage() {
  const brands = await getAllBrands();
  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <header className="mb-4">
        <Link
          href="/admin/promociones"
          className="text-xs text-bronceado hover:text-carbon"
        >
          ← volver
        </Link>
        <h1 className="font-display font-semibold text-xl text-carbon mt-1">
          nueva promoción
        </h1>
        <p className="text-xs text-tinta-suave mt-1 leading-relaxed">
          registra una promoción tras cobrar manual (transferencia/Khipu). El
          local pasa a destacado hasta el final del período. El cron diario
          revierte la flag al vencer.
        </p>
      </header>

      <form
        action={createSubscriptionAction}
        className="flex flex-col gap-4 bg-white border border-crema-edge rounded-xl p-4"
      >
        <div>
          <label className="text-xs font-medium text-carbon mb-1 block">
            target
          </label>
          <TargetSelector
            brands={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
          />
        </div>

        <div>
          <label
            htmlFor="tier"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            tier
          </label>
          <select
            id="tier"
            name="tier"
            defaultValue="featured"
            required
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          >
            <option value="featured">
              featured — boost en sorts + pin tomate + badge
            </option>
            <option value="premium">
              premium — featured + stats owner + responder + +fotos (15)
            </option>
            <option value="promo">
              promo — habilita ofertas (descuentos, productos) + ring tomate
            </option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="amountClp"
              className="text-xs font-medium text-carbon mb-1 block"
            >
              monto (CLP)
            </label>
            <input
              id="amountClp"
              name="amountClp"
              type="number"
              min="0"
              step="1000"
              defaultValue="20000"
              required
              className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
            />
          </div>
          <div>
            <label
              htmlFor="periodDays"
              className="text-xs font-medium text-carbon mb-1 block"
            >
              duración (días)
            </label>
            <select
              id="periodDays"
              name="periodDays"
              defaultValue="30"
              required
              className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
            >
              <option value="7">7 (prueba)</option>
              <option value="30">30 (mensual)</option>
              <option value="60">60</option>
              <option value="90">90 (trimestral)</option>
              <option value="180">180</option>
              <option value="365">365 (anual)</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="externalId"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            ref externa <span className="text-bronceado">(opcional)</span>
          </label>
          <input
            id="externalId"
            name="externalId"
            type="text"
            placeholder="ej. khipu-payment-xyz123"
            maxLength={120}
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="text-xs font-medium text-carbon mb-1 block"
          >
            notas <span className="text-bronceado">(opcional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="ej. transferencia BancoEstado 14/05"
            maxLength={500}
            className="w-full bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon focus:outline-none focus:border-mostaza resize-none"
          />
        </div>

        <Button type="submit" variant="primary" size="md" fullWidth>
          crear promoción
        </Button>
      </form>
    </main>
  );
}
