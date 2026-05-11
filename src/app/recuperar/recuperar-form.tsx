"use client";

import { IconMail } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { requestPasswordReset, type RequestState } from "./actions";

const RECOVERY_OK_MESSAGE =
  "Si esa cuenta existe, te mandamos un link para crear una nueva contraseña. Revisa tu correo.";

const initialState: RequestState = {};

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          className="text-sm text-carbon bg-lechuga/10 border border-lechuga/30 rounded-md px-3.5 py-3 leading-snug"
        >
          {RECOVERY_OK_MESSAGE}
        </p>
        <Link href="/iniciar-sesion" className="text-center text-xs text-tinta-suave underline">
          volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" action={formAction}>
      <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-3">
        <IconMail size={18} className="text-bronceado" aria-hidden="true" />
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="tu@email.cl"
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
        {pending ? "enviando…" : "enviar link"}
      </Button>
    </form>
  );
}
