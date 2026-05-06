"use client";

import { IconBrandGoogle, IconLock, IconMail } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { signInWithCredentials, signInWithGoogle, type SignInState } from "./actions";

const initialState: SignInState = {};

export function IniciarSesionForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(signInWithCredentials, initialState);

  return (
    <>
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

        <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-3">
          <IconLock size={18} className="text-bronceado" aria-hidden="true" />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            minLength={8}
            required
            placeholder="contraseña"
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

        <div className="text-right">
          <Link href="/recuperar" className="text-xs text-tomate font-medium">
            ¿olvidaste tu contraseña?
          </Link>
        </div>

        <Button variant="primary" size="lg" fullWidth type="submit" disabled={pending}>
          {pending ? "iniciando…" : "iniciar sesión"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-crema-edge" />
        <span className="text-[10px] text-bronceado tracking-widest font-medium">
          O CONTINÚA CON
        </span>
        <div className="flex-1 h-px bg-crema-edge" />
      </div>

      {googleEnabled ? (
        <form action={signInWithGoogle}>
          <Button variant="secondary" size="lg" fullWidth type="submit">
            <IconBrandGoogle size={18} aria-hidden="true" /> Google
          </Button>
        </form>
      ) : (
        <Button variant="secondary" size="lg" fullWidth type="button" disabled>
          <IconBrandGoogle size={18} aria-hidden="true" /> Google (no configurado)
        </Button>
      )}
    </>
  );
}
