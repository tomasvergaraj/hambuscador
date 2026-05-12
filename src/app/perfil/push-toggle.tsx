"use client";

import { IconBellOff, IconBellRinging } from "@tabler/icons-react";
import * as React from "react";

import { subscribePushAction, unsubscribePushAction } from "./actions";

type Status = "loading" | "unsupported" | "denied" | "off" | "on" | "configuring";

type Props = {
  vapidPublicKey: string | undefined;
};

/**
 * Toggle para opt-in/out de notificaciones push web. Lee el estado actual
 * del browser (Permission API + ServiceWorkerRegistration.pushManager) y
 * sincroniza con el server cuando el user cambia el estado.
 *
 * Flow on:
 *   1. Pide permiso al user (Notification.requestPermission)
 *   2. Suscribe con la VAPID public key
 *   3. POST sub al server (subscribePushAction)
 *
 * Flow off:
 *   1. unsubscribe() en el browser (libera endpoint en el push service)
 *   2. DELETE sub del server (unsubscribePushAction) con el endpoint
 *
 * Si VAPID no está configurado en el server (env vars), no renderiza nada —
 * la feature está inactiva. En dev sin VAPID el toggle queda oculto.
 */
export function PushToggle({ vapidPublicKey }: Props) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!vapidPublicKey) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function turnOn() {
    if (!vapidPublicKey) return;
    setError(null);
    setStatus("configuring");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON() as PushSubscriptionJSON;
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("sub incompleta");
      }
      const result = await subscribePushAction({
        sub: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setError(result.error ?? "no pudimos activarlas");
        await sub.unsubscribe().catch(() => {});
        setStatus("off");
        return;
      }
      setStatus("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error desconocido");
      setStatus("off");
    }
  }

  async function turnOff() {
    setError(null);
    setStatus("configuring");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setStatus("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error desconocido");
      setStatus("on");
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  const isOn = status === "on";
  const busy = status === "configuring";

  return (
    <button
      type="button"
      onClick={isOn ? turnOff : turnOn}
      disabled={status === "denied" || busy}
      className="w-full flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-lg p-3 hover:border-mostaza/50 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.98] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed text-left"
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
          isOn ? "bg-lechuga/20 text-lechuga" : "bg-crema-edge text-bronceado"
        }`}
      >
        {isOn ? (
          <IconBellRinging size={18} aria-hidden="true" />
        ) : (
          <IconBellOff size={18} aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-carbon">
          {isOn ? "push activado" : "activar push"}
        </p>
        <p className="text-[11px] text-bronceado leading-relaxed">
          {status === "denied"
            ? "permiso denegado en el browser — habilítalo en ajustes del sitio"
            : isOn
              ? "recibes alertas del browser"
              : busy
                ? "configurando..."
                : "alertas en tiempo real en este dispositivo"}
        </p>
        {error && (
          <p className="text-[11px] text-tomate mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          isOn ? "bg-lechuga" : "bg-bronceado/40"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 bg-white rounded-full transition-transform ${
            isOn ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Convierte VAPID public key base64url → Uint8Array como requiere
 * pushManager.subscribe.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
