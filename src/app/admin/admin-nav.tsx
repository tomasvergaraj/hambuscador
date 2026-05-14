"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AdminNavProps = {
  pendingCount: number;
  claimsCount: number;
};

type Tab = {
  href: string;
  label: string;
  badge?: { count: number; tone: "mostaza" | "tomate"; aria: string } | null;
};

export function AdminNav({ pendingCount, claimsCount }: AdminNavProps) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      href: "/admin/moderacion",
      label: "pendientes",
      badge:
        pendingCount > 0
          ? {
              count: pendingCount,
              tone: "mostaza",
              aria: `${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`,
            }
          : null,
    },
    {
      href: "/admin/claims",
      label: "claims",
      badge:
        claimsCount > 0
          ? {
              count: claimsCount,
              tone: "tomate",
              aria: `${claimsCount} ${claimsCount === 1 ? "claim" : "claims"}`,
            }
          : null,
    },
    { href: "/admin/places", label: "locales" },
    { href: "/admin/resenas", label: "reseñas" },
    { href: "/admin/usuarios", label: "usuarios" },
    { href: "/admin/picas", label: "picás" },
    { href: "/admin/search", label: "búsquedas" },
    { href: "/admin/perf", label: "perf" },
  ];

  return (
    <nav
      aria-label="secciones admin"
      className="bg-carbon-soft text-crema-edge border-b border-carbon overflow-x-auto scrollbar-hide"
    >
      <div className="flex gap-3 px-4 w-max min-w-full">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname?.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "text-xs py-2 border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors",
                isActive
                  ? "text-crema border-mostaza"
                  : "border-transparent hover:text-crema hover:border-mostaza/60"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold",
                    tab.badge.tone === "mostaza"
                      ? "bg-mostaza text-carbon"
                      : "bg-tomate text-crema-deep"
                  )}
                  aria-label={tab.badge.aria}
                >
                  {tab.badge.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
