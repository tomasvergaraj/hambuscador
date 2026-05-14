"use client";

import { IconCheck, IconMessageCircle, IconX } from "@tabler/icons-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { upsertReplyAction, deleteReplyAction } from "@/app/[comuna]/[slug]/reply-actions";

type Props = {
  reviewId: string;
  placeId: string;
  initialText: string | null;
};

/**
 * Form inline pa que owner premium responda una reseña. Collapsed por
 * default (CTA "responder"); expand a textarea + acciones. Si ya existe
 * reply muestra "editar respuesta" y permite borrar.
 *
 * Visible solo cuando el server ya validó owner + premium. No revalidación
 * client-side — el action vuelve a chequear.
 */
export function OwnerReplyForm({ reviewId, placeId, initialText }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(initialText ?? "");
  const [savedText, setSavedText] = useState(initialText ?? "");
  const [isPending, startTransition] = useTransition();

  const hasReply = savedText.trim().length > 0;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-2 relative z-20 inline-flex items-center gap-1.5 text-[11px] text-mostaza-deep hover:text-carbon font-medium transition-colors"
      >
        <IconMessageCircle size={13} aria-hidden="true" />
        {hasReply ? "editar respuesta" : "responder como dueño"}
      </button>
    );
  }

  function submit() {
    const value = text.trim();
    if (value.length === 0) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reviewId", reviewId);
      formData.set("placeId", placeId);
      formData.set("text", value);
      await upsertReplyAction(formData);
      setSavedText(value);
      setExpanded(false);
    });
  }

  function remove() {
    if (!hasReply) {
      setExpanded(false);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reviewId", reviewId);
      await deleteReplyAction(formData);
      setSavedText("");
      setText("");
      setExpanded(false);
    });
  }

  return (
    <div className="relative z-20 mt-2 bg-white border border-mostaza/40 rounded-md p-2 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="responde a esta reseña…"
        maxLength={500}
        rows={3}
        className="w-full bg-crema-deep border border-crema-edge rounded-md px-2 py-1.5 text-xs text-carbon placeholder:text-bronceado focus:outline-none focus:border-mostaza resize-none"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-bronceado">{text.length}/500</span>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            disabled={isPending}
          >
            <IconX size={12} aria-hidden="true" /> cerrar
          </Button>
          {hasReply && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={isPending}
            >
              borrar
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={isPending || text.trim().length === 0}
          >
            <IconCheck size={12} aria-hidden="true" /> guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
