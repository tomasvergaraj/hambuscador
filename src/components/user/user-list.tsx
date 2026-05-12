import { IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/utils";
import type { PublicUserLite } from "@/server/services/follows";

type Props = {
  items: PublicUserLite[];
  empty: string;
};

/**
 * Lista vertical de usuarios públicos. Items con username linkean a su
 * perfil; items sin username (raros — ban en proceso o estado inconsistente)
 * quedan inertes. Usado por /u/[username]/seguidores y /siguiendo.
 */
export function UserList({ items, empty }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-crema-deep border border-crema-edge rounded-lg px-4 py-10 text-center mt-2">
        <p className="text-sm text-tinta-suave">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((u) => {
        const initials = initialsFromName(u.name);
        const inner = (
          <>
            <Avatar
              image={u.image}
              initials={initials}
              size={44}
              className="bg-mostaza-deep text-carbon"
              alt={`avatar de ${u.name}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-carbon truncate">{u.name}</p>
              {u.username ? (
                <p className="text-[11px] text-tinta-suave truncate">@{u.username}</p>
              ) : null}
              {u.bio ? (
                <p className="text-[11px] text-tinta-suave mt-0.5 line-clamp-1 leading-relaxed">
                  {u.bio}
                </p>
              ) : null}
            </div>
            {u.username ? (
              <IconChevronRight
                size={16}
                className="text-bronceado shrink-0"
                aria-hidden="true"
              />
            ) : null}
          </>
        );

        const className =
          "flex items-center gap-3 bg-crema-deep border border-crema-edge rounded-lg p-3 transition-[transform,colors,box-shadow] duration-150 hover:border-mostaza/50 active:scale-[0.98] hover:shadow-md";

        return (
          <li key={u.id}>
            {u.username ? (
              <Link href={`/u/${u.username}`} className={className}>
                {inner}
              </Link>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
