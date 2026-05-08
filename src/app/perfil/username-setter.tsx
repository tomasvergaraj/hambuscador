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

  const username = state.ok ? draft.trim().toLowerCase() : currentUsername;

  if (username) {
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
        <details className="text-[11px] text-tinta-suave">
          <summary className="cursor-pointer hover:text-carbon transition-colors">
            cambiar
          </summary>
          <UsernameForm
            initial={username}
            formAction={formAction}
            pending={pending}
            error={state.error}
            draft={draft}
            setDraft={setDraft}
          />
        </details>
      </section>
    );
  }

  return (
    <section className="bg-crema-deep border border-crema-edge rounded-xl p-4">
      <p className="font-display font-semibold text-sm text-carbon">
        elige tu nombre público
      </p>
      <p className="text-[11px] text-tinta-suave mt-0.5 leading-relaxed">
        habilita <span className="font-mono">hambuscador.cl/u/tu-nombre</span>{" "}
        para compartir tus reseñas y favoritos.
      </p>
      <div className="mt-3">
        <UsernameForm
          formAction={formAction}
          pending={pending}
          error={state.error}
          draft={draft}
          setDraft={setDraft}
        />
      </div>
    </section>
  );
}

function UsernameForm({
  initial,
  formAction,
  pending,
  error,
  draft,
  setDraft,
}: {
  initial?: string;
  formAction: (fd: FormData) => void;
  pending: boolean;
  error?: string;
  draft: string;
  setDraft: (v: string) => void;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2">
        <span className="inline-flex items-center px-2 text-bronceado font-mono text-sm">
          @
        </span>
        <input
          name="username"
          value={draft}
          onChange={(e) => setDraft(e.target.value.toLowerCase())}
          placeholder={initial ?? "tu-nombre"}
          minLength={3}
          maxLength={30}
          pattern="[a-z0-9_-]+"
          className="flex-1 bg-white border border-crema-edge rounded-md px-3 py-2 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado font-mono"
        />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "..." : initial ? "cambiar" : "elegir"}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-[11px] text-tomate font-medium"
        >
          {error}
        </p>
      ) : (
        <p className="text-[10px] text-bronceado">
          minúsculas, números, _ y - · 3 a 30 caracteres
        </p>
      )}
    </form>
  );
}
