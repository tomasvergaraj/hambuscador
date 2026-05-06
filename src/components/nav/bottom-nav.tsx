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
import { BOTTOM_NAV_TABS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<(typeof BOTTOM_NAV_TABS)[number]["icon"], Icon> = {
  home: IconHome,
  search: IconSearch,
  map: IconMap,
  user: IconUser,
};

/**
 * Bottom navigation persistente. Marca como activo el tab cuya `href`
 * coincide (con / sin query) con el pathname actual.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-crema-edge px-4 pt-2.5 pb-3 flex justify-around items-center z-40"
    >
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
              "flex flex-col items-center gap-0.5 transition-colors",
              active ? "text-carbon" : "text-bronceado hover:text-tinta-suave",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} stroke={1.75} aria-hidden="true" />
            <span className={cn("text-[10px]", active && "font-medium")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
