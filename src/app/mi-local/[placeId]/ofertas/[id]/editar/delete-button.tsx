"use client";

import { IconTrash } from "@tabler/icons-react";
import { useTransition } from "react";

type Props = {
  title: string;
  action: () => Promise<void>;
};

export function DeleteOwnerPromoButton({ title, action }: Props) {
  const [pending, startTransition] = useTransition();

  function handle() {
    if (!window.confirm(`Eliminar oferta "${title}"?`)) return;
    startTransition(async () => {
      await action();
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-crema-deep bg-tomate hover:bg-tomate/90 px-3 py-2 rounded-md transition-colors disabled:opacity-60"
    >
      <IconTrash size={14} aria-hidden="true" />
      {pending ? "borrando..." : "borrar oferta"}
    </button>
  );
}
