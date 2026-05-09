"use client";

import { IconLock } from "@tabler/icons-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { resetPassword, type ResetState } from "../actions";

const initialState: ResetState = {};

export function ResetForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form className="flex flex-col gap-3" action={formAction}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-3">
        <IconLock size={18} className="text-bronceado" aria-hidden="true" />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="nueva contraseña"
          className="flex-1 bg-transparent outline-none text-sm text-carbon placeholder:text-bronceado"
        />
      </label>

      <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-3">
        <IconLock size={18} className="text-bronceado" aria-hidden="true" />
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="confirma la contraseña"
          className="flex-1 bg-transparent outline-none text-sm text-carbon placeholder:text-bronceado"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="text-xs text-tomate font-medium bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2"
        >
          {state.error}
        </p>
      ) : null}

      <Button variant="primary" size="lg" fullWidth type="submit" disabled={pending}>
        {pending ? "guardando…" : "guardar contraseña"}
      </Button>
    </form>
  );
}
