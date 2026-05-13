import { IconEdit, IconExternalLink, IconPlus } from "@tabler/icons-react";
import Link from "next/link";

import { getAllPicasListsForAdmin } from "@/server/services/picas-lists";

export const metadata = { title: "admin · picás" };
export const dynamic = "force-dynamic";

export default async function AdminPicasIndex() {
  const lists = await getAllPicasListsForAdmin();
  const active = lists.filter((l) => l.isActive).length;

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="font-display font-semibold text-xl text-carbon">
          listas curadas
        </h1>
        <span className="text-xs text-tinta-suave">
          {active} activas · {lists.length} total
        </span>
      </div>
      <p className="text-xs text-tinta-suave mb-4">
        editables aquí. los cambios se reflejan en `/picas`, el sitemap y el
        dropdown de búsqueda al rato (cache 5-10min).
      </p>

      <Link
        href="/admin/picas/nueva"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-carbon bg-mostaza hover:bg-mostaza-deep px-3 py-2 rounded-full transition-[transform,colors] active:scale-95"
      >
        <IconPlus size={14} />
        nueva lista
      </Link>

      {lists.length === 0 ? (
        <div className="mt-4 bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            no hay listas todavía
          </p>
          <p className="text-xs text-tinta-suave mt-2">
            corré `pnpm db:seed-picas` para cargar las 32 iniciales, o creá una
            nueva desde el botón de arriba.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lists.map((list) => (
            <li
              key={list.slug}
              className="bg-white border border-crema-edge rounded-xl p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-semibold text-sm text-carbon truncate">
                    {list.title}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider font-medium bg-crema-edge/60 text-tinta-suave px-1.5 py-0.5 rounded">
                    /{list.slug}
                  </span>
                  {!list.isActive && (
                    <span className="text-[10px] uppercase tracking-wider font-medium bg-tomate/15 text-tomate px-1.5 py-0.5 rounded">
                      inactiva
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider font-medium bg-mostaza/20 text-mostaza-deep px-1.5 py-0.5 rounded">
                    {list.icon}
                  </span>
                </div>
                <p className="text-[11px] text-bronceado mt-0.5 truncate">
                  {list.hook}
                </p>
                <p className="text-[10px] text-bronceado mt-0.5 truncate">
                  max {list.maxItems} · orden {list.sortOrder}
                </p>
              </div>
              <Link
                href={`/picas/${list.slug}`}
                target="_blank"
                rel="noopener"
                aria-label="ver lista pública"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-bronceado hover:bg-crema-deep hover:text-carbon transition-colors"
              >
                <IconExternalLink size={16} />
              </Link>
              <Link
                href={`/admin/picas/${list.slug}/editar`}
                aria-label="editar"
                className="inline-flex items-center gap-1 text-xs font-medium text-carbon bg-mostaza hover:bg-mostaza-deep px-3 py-1.5 rounded-full transition-[transform,colors] active:scale-95"
              >
                <IconEdit size={14} />
                editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
