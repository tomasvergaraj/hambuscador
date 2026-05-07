"use client";

import { IconDownload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

// =============================================================================
// PwaInstaller — registra el service worker y muestra un toast con
// "instalar app" cuando el browser dispara `beforeinstallprompt`.
//
// Solo Chrome/Edge/Android dispatchean ese evento. Safari iOS exige un
// flujo manual (Compartir → Agregar a inicio) — ahí el toast no aparece.
// =============================================================================

// localStorage: lo marcamos cuando el usuario hace "después" o "X" — no
// volver a mostrar nunca (hasta que limpie storage).
const DISMISSED_KEY = "hb-install-dismissed";
// sessionStorage: lo marcamos al primer render del toast — así no reaparece
// en cada navegación cliente. Reset al cerrar pestaña.
const SHOWN_THIS_SESSION_KEY = "hb-install-shown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstaller() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Registro del service worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No es crítico — la app funciona sin SW
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Listener de install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (sessionStorage.getItem(SHOWN_THIS_SESSION_KEY)) return;

    const onPrompt = (e: Event) => {
      // Evita el banner default del browser para usar el nuestro
      e.preventDefault();
      // Marca shown para esta sesión — Chrome redispatcha el evento en
      // algunas navegaciones, sin esto el toast reaparece cada cambio
      // de pantalla.
      sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "1");
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setVisible(false);
    setInstallEvent(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-[slideUp_0.25s_ease-out]">
      <div className="bg-carbon text-crema rounded-xl shadow-lg p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-mostaza shrink-0 flex items-center justify-center text-xl">
          🍔
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm">
            instala hambuscador
          </p>
          <p className="text-[11px] text-crema-edge mt-0.5 leading-snug">
            agrégalo a tu pantalla de inicio para abrirlo más rápido
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1 bg-mostaza text-carbon font-display font-semibold text-xs px-3 py-1.5 rounded-md transition-transform active:scale-95"
            >
              <IconDownload size={13} aria-hidden="true" /> instalar
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-[11px] text-crema-edge hover:text-crema px-2"
            >
              después
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="cerrar"
          className="text-crema-edge hover:text-crema p-1 -mt-1 -mr-1"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
