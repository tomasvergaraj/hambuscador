"use client";

import { IconCheck } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { PhotoUploader } from "@/components/place/photo-uploader";
import { Button } from "@/components/ui/button";

import { submitClaimAction, type ClaimState } from "./actions";

const initial: ClaimState = {};

type Props = {
  comuna: string;
  slug: string;
  placeName: string;
  defaultEmail: string;
};

export function ClaimForm({ comuna, slug, placeName, defaultEmail }: Props) {
  const boundAction = submitClaimAction.bind(null, comuna, slug);
  const [state, formAction, pending] = useActionState(boundAction, initial);

  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  // Reusamos PhotoUploader (acepta image/jpeg|png|webp). Para un proof
  // más estructurado (PDF) habría que extender el uploader; jpg de la
  // foto del cert SII funciona en la mayoría de casos.
  const [proof, setProof] = useState<string[]>([]);

  if (state?.ok) {
    return (
      <div className="rounded-xl bg-lechuga/10 border border-lechuga/30 p-6 text-center">
        <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-lechuga text-crema-deep mb-3">
          <IconCheck size={24} aria-hidden="true" />
        </div>
        <h2 className="font-display font-semibold text-lg text-carbon">
          solicitud enviada
        </h2>
        <p className="text-sm text-tinta-suave mt-2 leading-relaxed">
          Recibimos tu reclamo de <strong>{placeName}</strong>. El equipo lo
          revisa y te avisamos al email de contacto cuando se apruebe (puede
          tardar 1-3 días).
        </p>
        <Link
          href={`/${comuna}/${slug}`}
          className="inline-block mt-4 text-sm font-medium text-tomate hover:opacity-80"
        >
          volver al local →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="proofUrl" value={proof[0] ?? ""} />

      <Field
        label="email de contacto"
        hint="te avisamos por acá cuando aprobamos. usa el email del negocio si tienes uno."
      >
        <input
          type="email"
          name="contactEmail"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          autoComplete="email"
          className={INPUT_CLS}
        />
      </Field>

      <Field
        label="teléfono (opcional)"
        hint="el admin puede llamar para confirmar."
      >
        <input
          type="tel"
          name="contactPhone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          className={INPUT_CLS}
        />
      </Field>

      <Field
        label="prueba de propiedad (opcional)"
        hint="foto del certificado SII, foto del local con un papel firmado del día, captura de Google Business — lo que quieras compartir."
      >
        <PhotoUploader value={proof} onChange={setProof} max={1} />
      </Field>

      <Field
        label="mensaje (opcional)"
        hint="cuéntanos algo del local — tu rol, redes, lo que ayude a verificar."
      >
        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={800}
          placeholder="ej. soy el dueño desde 2019, mi @ es..."
          className={`${INPUT_CLS} resize-y`}
        />
      </Field>

      {state?.error && (
        <p
          role="alert"
          className="text-xs text-tomate font-medium bg-tomate/10 border border-tomate/30 rounded-md px-3 py-2"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending}>
        {pending ? "enviando..." : "enviar solicitud"}
      </Button>

      <p className="text-[11px] text-bronceado leading-relaxed">
        Al enviar, declaras que eres el dueño o representante autorizado del
        local. Una solicitud con info falsa puede llevar a baneo de cuenta.
      </p>
    </form>
  );
}

const INPUT_CLS =
  "w-full bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5 text-sm text-carbon placeholder:text-bronceado outline-none focus:border-bronceado";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-carbon font-medium">{label}</span>
      {hint ? <span className="text-[10px] text-bronceado">{hint}</span> : null}
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
