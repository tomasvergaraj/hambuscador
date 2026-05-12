"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";

export type HeaderProps = {
  /**
   * Si está seteado, muestra el `title` en el centro y un back/close button
   * en la izquierda en lugar del logo. Si no, muestra el logo (default home).
   */
  title?: string;
  /** Subtítulo opcional debajo del título. */
  subtitle?: string;
  /**
   * Si es `true`, muestra una X en lugar del back arrow.
   * Útil para sheets y wizards que se cierran sin volver atrás.
   */
  isModal?: boolean;
  /**
   * Iniciales del usuario logueado. Si está seteado, muestra avatar en la
   * derecha. Solo aplica cuando NO hay title (vista home).
   */
  avatarInitials?: string;
  /**
   * URL del avatar real (Google picture o R2 custom). Si está, prima sobre
   * `avatarInitials` (que sirve de fallback si la imagen falla).
   */
  avatarImage?: string | null;
  /**
   * Si está seteado, el botón "atrás" navega a esta ruta en vez de hacer
   * `router.back()`. Útil para páginas-destino (tabs como /picas, /perfil)
   * donde el usuario espera volver a inicio, no a la página de origen.
   */
  backHref?: string;
};

/**
 * Header universal. Tres modos:
 * - `<Header />` o `<Header avatarInitials="JM" />` → logo + (avatar | iniciar sesión)
 * - `<Header title="..." />` → back arrow + título
 * - `<Header title="..." isModal />` → X + título
 */
export function Header({
  title,
  subtitle,
  isModal,
  avatarInitials,
  avatarImage,
  backHref,
}: HeaderProps) {
  const router = useRouter();

  // Modo título (back/modal con texto centrado)
  if (title) {
    const buttonClass =
      "w-8 h-8 -ml-1 flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90";
    const Icon = isModal ? IconX : IconArrowLeft;
    const ariaLabel = isModal ? "Cerrar" : "Volver";

    return (
      <header className="flex items-center px-4 pt-3.5 pb-2">
        {backHref ? (
          <Link href={backHref} aria-label={ariaLabel} className={buttonClass}>
            <Icon size={20} stroke={1.75} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={ariaLabel}
            className={buttonClass}
          >
            <Icon size={20} stroke={1.75} />
          </button>
        )}
        <div className="flex-1 text-center">
          <h1 className="font-display font-semibold text-base text-carbon leading-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[11px] text-bronceado leading-tight mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
        {/* Spacer para centrar el título */}
        <div className="w-8" />
      </header>
    );
  }

  // Modo home (logo + avatar/iniciar sesión)
  return (
    <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
      <Link href="/" aria-label="Hambuscador inicio">
        <Logo variant="full" size={28} />
      </Link>
      {avatarInitials ? (
        <Link
          href="/perfil"
          className="hover:opacity-80 transition-[transform,opacity] duration-150 active:scale-90"
          aria-label="Mi perfil"
        >
          <Avatar
            image={avatarImage ?? null}
            initials={avatarInitials}
            size={32}
            className="bg-mostaza-deep text-carbon"
            alt="mi perfil"
          />
        </Link>
      ) : (
        <Link
          href="/iniciar-sesion"
          className="text-xs text-carbon font-medium hover:text-tomate transition-colors"
        >
          iniciar sesión
        </Link>
      )}
    </header>
  );
}
