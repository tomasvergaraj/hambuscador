import { IconArrowRight, IconBan, IconRotate, IconShield, IconShieldOff, IconSearch } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth";
import { getAdminUsers, type UserCursor } from "@/server/services/users";

import { banUserAction, setUserRoleAction, unbanUserAction } from "./actions";

export const metadata = {
  title: "moderar usuarios",
};

// Panel admin lee estado fresco
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = { cursor?: string; q?: string };

function decodeCursor(raw: string | undefined): UserCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as UserCursor;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function encodeCursor(c: UserCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { cursor: cursorParam, q } = await searchParams;
  const cursor = decodeCursor(cursorParam);

  const [{ items, nextCursor }, session] = await Promise.all([
    getAdminUsers({ limit: PAGE_SIZE, cursor, q }),
    auth(),
  ]);
  const myId = session?.user?.id ?? null;

  return (
    <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display font-semibold text-xl text-carbon">
          moderar usuarios
        </h1>
        <span className="text-xs text-tinta-suave">
          {items.length === 0
            ? "sin usuarios"
            : cursor
              ? `mostrando ${items.length}`
              : `últimos ${items.length}`}
        </span>
      </div>

      {/* Search por email/nombre */}
      <form action="/admin/usuarios" method="get" className="mb-4">
        <div className="flex items-center gap-2 bg-white rounded-md border border-crema-edge focus-within:border-mostaza transition-colors px-3 py-2 text-sm">
          <IconSearch size={16} className="text-bronceado shrink-0" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="buscar por email o nombre"
            className="flex-1 bg-transparent outline-none text-carbon placeholder:text-bronceado"
          />
        </div>
      </form>

      {items.length === 0 ? (
        <div className="bg-crema-deep border border-crema-edge rounded-xl p-8 text-center">
          <p className="font-display font-semibold text-base text-carbon">
            {q ? "no hay usuarios para esa búsqueda" : "no hay usuarios"}
          </p>
          {q ? (
            <Link
              href="/admin/usuarios"
              className="inline-block mt-3 text-xs text-tomate font-medium hover:opacity-80"
            >
              limpiar filtro
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((u) => {
            const isSelf = u.id === myId;
            const isBanned = Boolean(u.bannedAt);
            const isAdmin = u.role === "admin";
            return (
              <li
                key={u.id}
                className="bg-white border border-crema-edge rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-semibold text-sm text-carbon truncate">
                        {u.name ?? u.email}
                      </p>
                      {isAdmin ? (
                        <span className="text-[9px] font-medium tracking-wider text-mostaza-deep bg-mostaza/15 px-1.5 py-0.5 rounded uppercase">
                          admin
                        </span>
                      ) : null}
                      {isBanned ? (
                        <span className="text-[9px] font-medium tracking-wider text-tomate bg-tomate/10 px-1.5 py-0.5 rounded uppercase">
                          baneado
                        </span>
                      ) : null}
                      {isSelf ? (
                        <span className="text-[9px] font-medium tracking-wider text-bronceado bg-crema-edge px-1.5 py-0.5 rounded uppercase">
                          tú
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-tinta-suave truncate mt-0.5">
                      {u.email}
                    </p>
                    <p className="text-[10px] text-bronceado mt-0.5">
                      {u.reviewCount} {u.reviewCount === 1 ? "reseña" : "reseñas"} · alta {fmtDate(u.createdAt)}
                    </p>
                  </div>
                </div>

                {!isSelf ? (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {isAdmin ? (
                      <form action={setUserRoleAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value="user" />
                        <Button variant="secondary" size="sm" type="submit">
                          <IconShieldOff size={13} aria-hidden="true" />{" "}
                          quitar admin
                        </Button>
                      </form>
                    ) : (
                      <form action={setUserRoleAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="role" value="admin" />
                        <Button variant="secondary" size="sm" type="submit">
                          <IconShield size={13} aria-hidden="true" />{" "}
                          hacer admin
                        </Button>
                      </form>
                    )}
                    {isBanned ? (
                      <form action={unbanUserAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button variant="secondary" size="sm" type="submit">
                          <IconRotate size={13} aria-hidden="true" /> reactivar
                        </Button>
                      </form>
                    ) : (
                      <form action={banUserAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button variant="danger" size="sm" type="submit">
                          <IconBan size={13} aria-hidden="true" /> banear
                        </Button>
                      </form>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && nextCursor ? (
        <div className="mt-5 flex justify-end">
          <Link
            href={`/admin/usuarios?${new URLSearchParams({
              ...(q ? { q } : {}),
              cursor: encodeCursor(nextCursor),
            }).toString()}`}
            className="inline-flex items-center gap-1 text-xs text-tomate font-medium hover:opacity-80"
          >
            siguientes <IconArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {cursor ? (
        <div className="mt-2 flex justify-start">
          <Link
            href={q ? `/admin/usuarios?q=${encodeURIComponent(q)}` : "/admin/usuarios"}
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
