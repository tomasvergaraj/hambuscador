"use client";

import * as React from "react";
import { IconExternalLink, IconUser } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { setUsernameAction, type SetUsernameState } from "./actions";

const initial: SetUsernameState = {};

/**
 * Card en /perfil que muestra el perfil público del usuario o un form para
 * setear/cambiar el username. Sin username el usuario es privado (no hay
 * /u/[username] al que linkear).
 */
export function UsernameSetter({
  currentUsername,
}: {
  currentUsername: string | null;
}) {
  const [state, formAction, pending] = React.useActionState(
    setUsernameAction,
    initial,
  );
  const [draft, setDraft] = React.useState(currentUsername ?? "");
  const [editing, setEditing] = React.useState(currentUsername === null);

  // Después de un update exitoso, el username "actual" pasa a ser el draft;
  // colapsamos el form. revalidatePath en el action ya refresca currentUsername
  // en el próximo render server, pero hasta entonces usamos el draft local.
  const username = state.ok ? draft.trim().toLowerCase() : currentUsername;

  React.useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (username && !editing) {
    return (
      <section className="bg-crema-deep border border-crema-edge rounded-xl p-3 flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-mostaza/15 inline-flex items-center justify-center text-mostaza shrink-0">
          <IconUser size={16} stroke={1.75} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-tinta-suave">tu perfil público</p>
          <Link
            href={`/u/${username}`}
            className="font-display font-semibold text-sm text-carbon truncate hover:text-mostaza-deep inline-flex items-center gap-1"
          >
            @{username}
            <IconExternalLink size={12} aria-hidden="true" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-tinta-suave hover:text-carbon transition-colors shrink-0 px-2 py-1 rounded hover:bg-white/60"
        >
          cambiar
        </button>
      </section>
    );
  }

  // Modo edit/elegir: layout column.
  return (
    <section className="bg-crema-deep border border-crema-edge rounded-xl p-4 flex flex-col gap-2">
      <div>
        <p className="font-display font-semibold text-sm text-carbon">
          {username ? "cambiar tu nombre público" : "elige tu nombre público"}
        </p>
        <p className="text-[11px] text-tinta-suave mt-0.5 leading-relaxed">
          habilita <span className="font-mono">hambuscador.cl/u/tu-nombre</span>{" "}
          para compartir tus reseñas y favoritos.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-2 mt-1">
        <div className="flex gap-2">
          <span className="inline-flex items-center px-2 text-bronceado font-mono text-sm bg-white border border-crema-edge rounded-md">
            @
          </span>
          <input
            name="username"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase())}
            placeholder={username ?? "tu-nombre"}
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_-]+"
            autoFocus
            className="flex-1 min-w-0 bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado font-mono"
          />
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "..." : username ? "guardar" : "elegir"}
          </Button>
        </div>
        {state.error ? (
          <p role="alert" className="text-[11px] text-tomate font-medium">
            {state.error}
          </p>
        ) : (
          <p className="text-[10px] text-bronceado">
            minúsculas, números, _ y - · 3 a 30 caracteres
          </p>
        )}
        {username && (
          <button
            type="button"
            onClick={() => {
              setDraft(username);
              setEditing(false);
            }}
            className="text-[11px] text-tinta-suave hover:text-carbon transition-colors self-start"
          >
            cancelar
          </button>
        )}
      </form>
    </section>
  );
}
