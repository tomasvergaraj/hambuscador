"use client";

import { IconBrandGoogle, IconCheck, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { registerUser, signInWithGoogle, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegistroForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(registerUser, initialState);

  return (
    <>
      <form className="flex flex-col gap-2.5" action={formAction}>
        <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-2.5">
          <IconUser size={16} className="text-bronceado" aria-hidden="true" />
          <input
            type="text"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            placeholder="tu nombre"
            className="flex-1 bg-transparent outline-none text-sm text-carbon placeholder:text-bronceado"
          />
        </label>

        <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-2.5">
          <IconMail size={16} className="text-bronceado" aria-hidden="true" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="tu@email.cl"
            className="flex-1 bg-transparent outline-none text-sm text-carbon placeholder:text-bronceado"
          />
        </label>

        <label className="flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-md px-3.5 py-2.5">
          <IconLock size={16} className="text-bronceado" aria-hidden="true" />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="contraseña (8+ caracteres)"
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

        <label className="flex items-start gap-2 mt-3">
          <span className="w-4 h-4 mt-0.5 inline-flex items-center justify-center rounded bg-mostaza shrink-0">
            <IconCheck size={11} className="text-carbon" aria-hidden="true" />
          </span>
          <span className="text-[11px] text-tinta-suave leading-relaxed">
            acepto los{" "}
            <Link href="/legal/terminos" className="text-carbon font-medium underline">
              términos
            </Link>{" "}
            y la{" "}
            <Link href="/legal/privacidad" className="text-carbon font-medium underline">
              política de privacidad
            </Link>
          </span>
        </label>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          type="submit"
          className="mt-2"
          disabled={pending}
        >
          {pending ? "creando…" : "crear cuenta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-crema-edge" />
        <span className="text-[9px] text-bronceado tracking-widest font-medium">
          O REGÍSTRATE CON
        </span>
        <div className="flex-1 h-px bg-crema-edge" />
      </div>

      {googleEnabled ? (
        <form action={signInWithGoogle}>
          <Button variant="secondary" size="md" fullWidth type="submit">
            <IconBrandGoogle size={16} aria-hidden="true" /> Google
          </Button>
        </form>
      ) : (
        <Button variant="secondary" size="md" fullWidth type="button" disabled>
          <IconBrandGoogle size={16} aria-hidden="true" /> Google (no configurado)
        </Button>
      )}
    </>
  );
}
