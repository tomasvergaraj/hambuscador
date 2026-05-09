"use client";

import { IconDownload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";

// =============================================================================
// PwaInstaller — registra el service worker y muestra un toast con
// "instalar app" cuando el browser dispara `beforeinstallprompt`.
//
// Solo Chrome/Edge/Android dispatchean ese evento. Safari iOS exige un
// flujo manual (Compartir → Agregar a inicio) — ahí el toast no aparece.
// =============================================================================

// Permanente: el usuario hizo "X" o instaló — no volver a mostrar nunca.
const DISMISSED_KEY = "hb-install-dismissed";
// Cooldown: se setea con timestamp ISO en cada exposición. Mientras esté
// dentro del cooldown, no mostramos. "después" extiende este timestamp.
const LAST_PROMPT_AT_KEY = "hb-install-last-prompt-at";
// Conteo de visitas (sesiones distintas). Solo prompteamos a partir de la
// 3ra visita — la 1ra y 2da el usuario está descubriendo la app, no
// queremos interrumpirlo todavía.
const VISIT_COUNT_KEY = "hb-install-visits";
// Marca que ya contamos esta sesión (sessionStorage).
const SESSION_COUNTED_KEY = "hb-install-session-counted";

const MIN_VISITS_BEFORE_PROMPT = 3;
const COOLDOWN_DAYS = 15;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isInCooldown(): boolean {
  const lastAt = localStorage.getItem(LAST_PROMPT_AT_KEY);
  if (!lastAt) return false;
  const ts = Date.parse(lastAt);
  if (Number.isNaN(ts)) return false;
  const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return days < COOLDOWN_DAYS;
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

  // Listener de install prompt (con gating de cooldown + visitas + interacción)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Contador de visitas: sumamos +1 una vez por sesión
    if (!sessionStorage.getItem(SESSION_COUNTED_KEY)) {
      const prev = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10);
      const next = (Number.isFinite(prev) ? prev : 0) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(next));
      sessionStorage.setItem(SESSION_COUNTED_KEY, "1");
    }

    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10);
    if (visits < MIN_VISITS_BEFORE_PROMPT) return;
    if (isInCooldown()) return;

    let pendingEvent: BeforeInstallPromptEvent | null = null;
    let interacted = false;

    const reveal = () => {
      if (!pendingEvent || !interacted) return;
      localStorage.setItem(LAST_PROMPT_AT_KEY, new Date().toISOString());
      setInstallEvent(pendingEvent);
      setVisible(true);
    };

    const onPrompt = (e: Event) => {
      e.preventDefault();
      pendingEvent = e as BeforeInstallPromptEvent;
      reveal();
    };

    const onInteract = () => {
      interacted = true;
      reveal();
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    // Esperamos al menos un scroll/click — significa que el usuario está
    // usando la app, no acaba de aterrizar.
    window.addEventListener("scroll", onInteract, { once: true, passive: true });
    window.addEventListener("pointerdown", onInteract, { once: true });

    const onInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, "1");
      setVisible(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
    setInstallEvent(null);
  }

  // "después": cierra ahora y arma cooldown de 14 días.
  function handleLater() {
    localStorage.setItem(LAST_PROMPT_AT_KEY, new Date().toISOString());
    setVisible(false);
  }

  // X: cierra para siempre.
  function handleDismissPermanent() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-[slideUp_0.25s_ease-out]">
      <div className="bg-carbon text-crema rounded-xl shadow-lg p-3 flex items-start gap-3">
        <Logo variant="icon" size={40} className="shrink-0 rounded-lg overflow-hidden" />

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
              onClick={handleLater}
              className="text-[11px] text-crema-edge hover:text-crema px-2"
            >
              después
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismissPermanent}
          aria-label="cerrar"
          className="text-crema-edge hover:text-crema p-1 -mt-1 -mr-1"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
