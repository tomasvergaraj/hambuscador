"use client";

import { IconTrash } from "@tabler/icons-react";
import { useTransition } from "react";

type Props = {
  brandName: string;
  action: () => Promise<void>;
};

export function DeleteBrandButton({ brandName, action }: Props) {
  const [pending, startTransition] = useTransition();

  function handle() {
    const typed = window.prompt(
      `BORRAR cadena "${brandName}".\n\nEscribe el nombre exacto para confirmar:`,
    );
    if (typed !== brandName) {
      if (typed !== null) window.alert("El nombre no coincide. Cancelado.");
      return;
    }
    startTransition(async () => {
      await action();
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-crema-deep bg-tomate hover:bg-tomate/90 px-3 py-2 rounded-md transition-colors disabled:opacity-60"
    >
      <IconTrash size={14} aria-hidden="true" />
      {pending ? "borrando..." : "borrar cadena"}
    </button>
  );
}
