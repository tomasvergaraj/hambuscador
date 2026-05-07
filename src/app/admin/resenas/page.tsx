import { IconArrowRight, IconExternalLink, IconTrash } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getRecentReviews, type ReviewCursor } from "@/server/services/reviews";

import { deleteReviewAdminAction } from "./actions";

export const metadata = {
  title: "moderar reseñas",
};

// Panel admin lee estado fresco — no cachear
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = { cursor?: string };

function decodeCursor(raw: string | undefined): ReviewCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ReviewCursor;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    // ignore — cursor malformado vuelve al inicio
  }
  return null;
}

function encodeCursor(c: ReviewCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { cursor: cursorParam } = await searchParams;
  const cursor = decodeCursor(cursorParam);
  const { items, nextCursor } = await getRecentReviews({
    limit: PAGE_SIZE,
    cursor,
  });

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display font-semibold text-xl text-carbon">
          moderar reseñas
        </h1>
        <span className="text-xs text-tinta-suave">
          {items.length === 0
            ? "sin reseñas"
            : cursor
              ? `mostrando ${items.length}`
              : `últimas ${items.length}`}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            {cursor ? "no hay más reseñas" : "no hay reseñas todavía"}
          </p>
          <p className="text-xs text-tinta-suave mt-2 leading-relaxed">
            {cursor
              ? "llegaste al final del listado."
              : "cuando alguien califique un local, aparece acá."}
          </p>
          {cursor ? (
            <Link
              href="/admin/resenas"
              className="inline-block mt-3 text-xs text-tomate font-medium hover:opacity-80"
            >
              volver al inicio
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id}>
              <article className="bg-white border border-crema-edge rounded-xl p-4">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-bronceado">
                      {r.author.name ?? r.author.email}{" "}
                      <span className="text-bronceado/70">
                        · {r.author.email}
                      </span>
                    </p>
                    <Link
                      href={`/${r.place.comunaSlug}/${r.place.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 mt-0.5 font-display font-semibold text-base text-carbon hover:text-tomate transition-colors"
                    >
                      {r.place.name}
                      <IconExternalLink size={13} aria-hidden="true" />
                    </Link>
                    <p className="text-[10px] text-bronceado">
                      {r.place.comunaLabel} · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-mostaza-deep bg-mostaza/15 px-2 py-1 rounded shrink-0">
                    {"★".repeat(r.rating)}
                  </span>
                </header>

                {r.text ? (
                  <p className="text-xs text-carbon leading-relaxed mt-3 whitespace-pre-wrap">
                    {r.text}
                  </p>
                ) : (
                  <p className="text-xs text-bronceado mt-3 italic">
                    sin texto
                  </p>
                )}

                {r.photos.length > 0 ? (
                  <p className="text-[10px] text-bronceado mt-2">
                    {r.photos.length} {r.photos.length === 1 ? "foto" : "fotos"}
                  </p>
                ) : null}

                <footer className="mt-4 flex justify-end">
                  <form action={deleteReviewAdminAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <Button variant="danger" size="sm" type="submit">
                      <IconTrash size={14} aria-hidden="true" /> borrar
                    </Button>
                  </form>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* Paginación cursor — sin offset, performance estable a cualquier
          profundidad. Si nextCursor es null, llegamos al final. */}
      {items.length > 0 && nextCursor ? (
        <div className="mt-5 flex justify-end">
          <Link
            href={`/admin/resenas?cursor=${encodeCursor(nextCursor)}`}
            className="inline-flex items-center gap-1 text-xs text-tomate font-medium hover:opacity-80"
          >
            siguientes <IconArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {cursor ? (
        <div className="mt-2 flex justify-start">
          <Link
            href="/admin/resenas"
            className="text-[11px] text-tinta-suave hover:text-carbon"
          >
            ← volver al inicio
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function fmtDate(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return `hace ${Math.floor(days / 365)} años`;
}
