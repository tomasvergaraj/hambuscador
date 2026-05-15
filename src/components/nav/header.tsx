import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";

import { BackButton } from "./back-button";

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
   * Ruta de fallback cuando NO hay historial de navegación en el tab (entrada
   * directa por deeplink, share, push notif). El comportamiento default del
   * back button es `router.back()` — vuelve a la página real desde donde el
   * user llegó, sin necesidad de que esta page la conozca. Sin historial
   * cae a esta ruta para no dejar al user encerrado.
   *
   * Antes este prop forzaba el back siempre a una ruta fija; ahora es solo
   * fallback. Páginas-destino (tabs /picas, /perfil) suelen pasar "/" acá.
   */
  backHref?: string;
};

/**
 * Header universal. Tres modos:
 * - `<Header />` o `<Header avatarInitials="JM" />` → logo + (avatar | iniciar sesión)
 * - `<Header title="..." />` → back button + título (router.back si hay historial)
 * - `<Header title="..." backHref="/" />` → back button con fallback a `/` si no hay historial
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
  if (title) {
    return (
      <header className="flex items-center px-4 pt-3.5 pb-2">
        <BackButton isModal={isModal} fallbackHref={backHref} />
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

  // Modo home (logo + avatar/iniciar sesión) — puro server, sin JS.
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
