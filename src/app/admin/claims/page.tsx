import {
  IconCheck,
  IconExternalLink,
  IconMail,
  IconPhone,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getPendingClaims } from "@/server/services/claims";

import { approveClaimAction, rejectClaimAction } from "./actions";

export const metadata = { title: "admin · claims" };
export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  const claims = await getPendingClaims();

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display font-semibold text-xl text-carbon">
          claims pendientes
        </h1>
        <span className="text-xs text-tinta-suave">
          {claims.length} {claims.length === 1 ? "solicitud" : "solicitudes"}
        </span>
      </div>

      {claims.length === 0 ? (
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            no hay claims pendientes
          </p>
          <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
            cuando un usuario reclame un local desde la ficha pública, aparece
            acá esperando aprobación.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="bg-white border border-crema-edge rounded-xl p-4 flex flex-col gap-3"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-display font-semibold text-base text-carbon truncate">
                      {claim.placeName}
                    </h2>
                    <Link
                      href={`/${claim.placeComunaSlug}/${claim.placeSlug}`}
                      target="_blank"
                      rel="noopener"
                      aria-label="ver ficha pública"
                      className="text-bronceado hover:text-carbon shrink-0"
                    >
                      <IconExternalLink size={14} />
                    </Link>
                  </div>
                  <p className="text-[11px] text-bronceado">
                    {claim.placeComunaLabel}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-widest font-medium text-mostaza-deep bg-mostaza/15 px-2 py-1 rounded shrink-0">
                  pending
                </span>
              </header>

              <section className="bg-crema-deep border border-crema-edge rounded-md p-3 flex flex-col gap-2 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="text-bronceado uppercase tracking-wider text-[9px] font-medium shrink-0">
                    user
                  </span>
                  <span className="text-carbon font-medium truncate">
                    {claim.userName ?? "(sin nombre)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconMail size={12} className="text-bronceado shrink-0" aria-hidden="true" />
                  <a
                    href={`mailto:${claim.contactEmail}`}
                    className="text-carbon hover:underline truncate"
                  >
                    {claim.contactEmail}
                  </a>
                  {claim.contactEmail !== claim.userEmail && (
                    <span className="text-[10px] text-bronceado">
                      (cuenta: {claim.userEmail})
                    </span>
                  )}
                </div>
                {claim.contactPhone && (
                  <div className="flex items-center gap-2">
                    <IconPhone
                      size={12}
                      className="text-bronceado shrink-0"
                      aria-hidden="true"
                    />
                    <a
                      href={`tel:${claim.contactPhone}`}
                      className="text-carbon hover:underline"
                    >
                      {claim.contactPhone}
                    </a>
                  </div>
                )}
                {claim.message && (
                  <div className="flex items-start gap-2 mt-1">
                    <span className="text-bronceado uppercase tracking-wider text-[9px] font-medium shrink-0 mt-0.5">
                      msg
                    </span>
                    <p className="text-carbon leading-relaxed whitespace-pre-line">
                      {claim.message}
                    </p>
                  </div>
                )}
              </section>

              {claim.proofUrl && (
                <a
                  href={claim.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative h-48 rounded-md overflow-hidden border border-crema-edge bg-crema-deep group"
                >
                  <Image
                    src={claim.proofUrl}
                    alt="proof de claim"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-contain group-hover:scale-105 transition-transform duration-200"
                  />
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-carbon/85 text-crema text-[10px] font-medium px-2 py-1 rounded backdrop-blur-sm">
                    abrir
                    <IconExternalLink size={11} aria-hidden="true" />
                  </span>
                </a>
              )}

              <footer className="flex gap-2 pt-1">
                <form action={rejectClaimAction} className="flex-1">
                  <input type="hidden" name="claimId" value={claim.id} />
                  <Button variant="secondary" size="md" fullWidth type="submit">
                    <IconX size={14} aria-hidden="true" /> rechazar
                  </Button>
                </form>
                <form action={approveClaimAction} className="flex-[2]">
                  <input type="hidden" name="claimId" value={claim.id} />
                  <Button variant="primary" size="md" fullWidth type="submit">
                    <IconCheck size={14} aria-hidden="true" /> aprobar
                  </Button>
                </form>
              </footer>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
