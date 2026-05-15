"use client";

import { IconArrowBackUp, IconX } from "@tabler/icons-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { rejectPromotionAction } from "./actions";

/**
 * Botón "rechazar" que expande inline una textarea pa que el admin escriba
 * un motivo opcional. El motivo viaja al server action y llega al owner en
 * la notif + email digest. Sin motivo: rechazo simple (owner ve copy genérico).
 *
 * Estados:
 * - collapsed: solo el botón "rechazar".
 * - expanded: textarea + "cancelar" + "confirmar rechazo".
 */
export function RejectPromoForm({ promoId }: { promoId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setExpanded(true)}
      >
        <IconX size={13} aria-hidden="true" /> rechazar
      </Button>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await rejectPromotionAction(formData);
          setExpanded(false);
          setReason("");
        });
      }}
      className="flex flex-col gap-2 bg-tomate/5 border border-tomate/30 rounded-md p-2.5"
    >
      <input type="hidden" name="promoId" value={promoId} />
      <label className="text-[11px] text-tinta-suave font-medium">
        motivo (opcional, llega al owner)
      </label>
      <textarea
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="ej. foto poco clara, fechas confusas"
        rows={2}
        maxLength={280}
        className="w-full text-xs border border-crema-edge rounded-md px-2 py-1.5 bg-white text-carbon resize-none focus:outline-none focus:border-tomate"
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setReason("");
          }}
          disabled={pending}
        >
          <IconArrowBackUp size={13} aria-hidden="true" /> cancelar
        </Button>
        <Button
          type="submit"
          variant="danger"
          size="sm"
          fullWidth
          disabled={pending}
        >
          <IconX size={13} aria-hidden="true" />{" "}
          {pending ? "rechazando…" : "confirmar rechazo"}
        </Button>
      </div>
    </form>
  );
}
