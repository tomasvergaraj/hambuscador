import { IconPhoto, IconPlus } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import { SearchBar } from "@/components/ui/search-bar";
import { getAllBrands } from "@/server/services/brands";

export const metadata = { title: "admin · cadenas" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; inactive?: string };

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const brands = await getAllBrands({
    query: sp.q?.trim() || undefined,
    includeInactive: sp.inactive === "1",
  });

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <header className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display font-semibold text-xl text-carbon">
            cadenas
          </h1>
          <p className="text-xs text-tinta-suave mt-0.5">
            {brands.length} {brands.length === 1 ? "marca" : "marcas"}
          </p>
        </div>
        <Link
          href="/admin/brands/nueva"
          className="inline-flex items-center gap-1.5 bg-mostaza text-carbon font-medium text-sm px-3 py-2 rounded-md hover:bg-mostaza-deep transition-colors"
        >
          <IconPlus size={16} aria-hidden="true" />
          nueva
        </Link>
      </header>

      <form action="/admin/brands" method="get" className="mb-3">
        <SearchBar
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="buscar por nombre"
        />
        {sp.inactive === "1" && (
          <input type="hidden" name="inactive" value="1" />
        )}
      </form>

      <nav className="flex gap-2 mb-4 text-xs">
        <Link
          href={`/admin/brands${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`}
          className={
            "px-3 py-1 rounded-full transition-colors " +
            (sp.inactive !== "1"
              ? "bg-carbon text-crema font-medium"
              : "text-tinta-suave hover:bg-crema-deep")
          }
        >
          activas
        </Link>
        <Link
          href={`/admin/brands?inactive=1${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
          className={
            "px-3 py-1 rounded-full transition-colors " +
            (sp.inactive === "1"
              ? "bg-carbon text-crema font-medium"
              : "text-tinta-suave hover:bg-crema-deep")
          }
        >
          todas
        </Link>
      </nav>

      {brands.length === 0 ? (
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            sin marcas
          </p>
          <p className="text-xs text-tinta-suave mt-2">
            crea una para agrupar locales bajo logo común.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/brands/${b.id}`}
                className="flex items-center gap-3 bg-white border border-crema-edge rounded-xl p-3 hover:border-mostaza transition-colors"
              >
                <div
                  className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden border border-crema-edge flex items-center justify-center"
                  style={{ background: b.color ?? "#FAF6EE" }}
                >
                  {b.logoUrl ? (
                    <Image
                      src={b.logoUrl}
                      alt={b.name}
                      fill
                      sizes="40px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <IconPhoto
                      size={16}
                      className="text-bronceado opacity-50"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display font-semibold text-sm text-carbon">
                      {b.name}
                    </h2>
                    {!b.isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-medium bg-bronceado/15 text-bronceado px-1.5 py-0.5 rounded">
                        inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-bronceado">
                    /{b.slug} · {b.placeCount}{" "}
                    {b.placeCount === 1 ? "local" : "locales"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
