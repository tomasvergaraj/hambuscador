"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconSearch,
  IconMap,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { BOTTOM_NAV_TABS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<(typeof BOTTOM_NAV_TABS)[number]["icon"], Icon> = {
  home: IconHome,
  search: IconSearch,
  map: IconMap,
  user: IconUser,
};

type Props = {
  /** Avatar real del user (URL) — solo el tab "perfil" lo usa. */
  avatarImage?: string | null;
  /** Iniciales para fallback en el tab perfil. */
  avatarInitials?: string;
};

/**
 * Bottom navigation persistente. Marca como activo el tab cuya `href`
 * coincide (con / sin query) con el pathname actual. El tab "perfil"
 * muestra el avatar real del user (Google o R2 custom) cuando hay sesión —
 * caso del usuario que se ve identificado mientras navega.
 */
export function BottomNavClient({ avatarImage, avatarInitials }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-crema-edge pt-2.5 z-40"
    >
      <div className="px-4 flex justify-around items-center">
        {BOTTOM_NAV_TABS.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          const tabPath = tab.href.split("?")[0]!;
          const active =
            tabPath === "/"
              ? pathname === "/"
              : pathname.startsWith(tabPath);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 transition-[transform,colors] duration-150 active:scale-90",
                active ? "text-carbon" : "text-bronceado hover:text-tinta-suave",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.icon === "user" && avatarInitials ? (
                <Avatar
                  image={avatarImage ?? null}
                  initials={avatarInitials}
                  size={22}
                  className={cn(
                    "text-[10px] font-medium",
                    active
                      ? "bg-mostaza-deep text-carbon ring-2 ring-mostaza/40"
                      : "bg-crema-edge text-tinta-suave",
                  )}
                  alt="mi perfil"
                />
              ) : (
                <Icon size={22} stroke={1.75} aria-hidden="true" />
              )}
              <span className={cn("text-[10px]", active && "font-medium")}>
                {tab.label}
              </span>
              {/* Indicador de tab activo — siempre presente para que el
                  layout no salte; transparente cuando inactivo */}
              <span
                aria-hidden="true"
                className={cn(
                  "h-[2px] w-5 rounded-full transition-colors mt-0.5",
                  active ? "bg-mostaza" : "bg-transparent",
                )}
              />
            </Link>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-bronceado/55 pt-1.5 pb-1">
        desarrollado por{" "}
        <a
          href="https://nexosoftware.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="text-bronceado/80 hover:text-bronceado transition-colors"
        >
          nexo software
        </a>
      </p>
    </nav>
  );
}
