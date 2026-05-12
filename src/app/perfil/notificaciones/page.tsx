import { IconBell, IconStarFilled, IconUserPlus } from "@tabler/icons-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { Avatar } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/utils";
import { auth } from "@/server/auth";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  type NewFollowerPayload,
  type NotificationItem,
  type ReviewOnOwnedPlacePayload,
} from "@/server/services/notifications";

export const metadata = {
  title: "notificaciones",
};

/**
 * Feed de notificaciones del user. Al abrir, marca todo como leído
 * (after()-deferred para no bloquear el render). Patrón "ya las vi al
 * entrar acá" — el badge en `/perfil` se vacía automáticamente.
 */
export default async function NotificacionesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion?next=/perfil/notificaciones");
  }
  const userId = session.user.id;
  const items = await getNotificationsForUser(userId);

  // Marca como leído después del render (no bloquea TTFB).
  after(async () => {
    await markAllNotificationsRead(userId);
  });

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="notificaciones" backHref="/perfil" />

      <main className="px-4 pt-2 flex-1">
        {items.length === 0 ? <EmptyFeed /> : <Feed items={items} />}
      </main>

      <BottomNav />
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-lg px-4 py-10 text-center mt-4">
      <div className="flex justify-center mb-3 text-bronceado">
        <IconBell size={32} stroke={1.5} aria-hidden="true" />
      </div>
      <p className="text-sm text-tinta-suave">
        sin notificaciones todavía.
      </p>
      <p className="text-xs text-bronceado mt-1.5 leading-relaxed">
        cuando alguien empiece a seguirte o deje una reseña en un local que
        reclamaste, te avisamos acá.
      </p>
    </div>
  );
}

function Feed({ items }: { items: NotificationItem[] }) {
  return (
    <ul className="flex flex-col gap-2 mt-2">
      {items.map((n) => (
        <li key={n.id}>{renderNotification(n)}</li>
      ))}
    </ul>
  );
}

function renderNotification(n: NotificationItem) {
  if (n.type === "review_on_owned_place") {
    return <ReviewOnOwnedPlaceCard n={n as NotificationItem<"review_on_owned_place">} />;
  }
  if (n.type === "new_follower") {
    return <NewFollowerCard n={n as NotificationItem<"new_follower">} />;
  }
  return null;
}

function NewFollowerCard({ n }: { n: NotificationItem<"new_follower"> }) {
  const p = n.payload as NewFollowerPayload;
  const unread = !n.readAt;
  const href = p.followerUsername ? `/u/${p.followerUsername}` : "/perfil/notificaciones";

  const inner = (
    <>
      <div className="relative shrink-0 mt-0.5">
        <Avatar
          image={p.followerImage}
          initials={initialsFromName(p.followerName)}
          size={36}
          className="bg-mostaza-deep text-carbon text-xs"
          alt={`avatar de ${p.followerName}`}
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-mostaza text-carbon border-2 border-crema-deep flex items-center justify-center"
        >
          <IconUserPlus size={10} stroke={2.5} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-carbon leading-snug">
          <span className="font-medium">{p.followerName}</span>{" "}
          empezó a seguirte
          {p.followerUsername ? (
            <span className="text-bronceado"> · @{p.followerUsername}</span>
          ) : null}
        </p>
        <p className="text-[10px] text-bronceado mt-1.5">
          hace {timeAgo(n.createdAt)}
        </p>
      </div>
    </>
  );

  const className = [
    "flex gap-3 rounded-lg p-3 border transition-[transform,colors,box-shadow] duration-150 active:scale-[0.98] hover:shadow-md",
    unread
      ? "bg-mostaza/10 border-mostaza/40 hover:bg-mostaza/15"
      : "bg-crema-deep border-crema-edge hover:border-mostaza/40",
  ].join(" ");

  if (p.followerUsername) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function ReviewOnOwnedPlaceCard({
  n,
}: {
  n: NotificationItem<"review_on_owned_place">;
}) {
  const p = n.payload as ReviewOnOwnedPlacePayload;
  const unread = !n.readAt;
  return (
    <Link
      href={`/r/${p.reviewId}`}
      className={[
        "flex gap-3 rounded-lg p-3 border transition-[transform,colors,box-shadow] duration-150 active:scale-[0.98] hover:shadow-md",
        unread
          ? "bg-mostaza/10 border-mostaza/40 hover:bg-mostaza/15"
          : "bg-crema-deep border-crema-edge hover:border-mostaza/40",
      ].join(" ")}
    >
      <div className="relative shrink-0 mt-0.5">
        <Avatar
          image={p.reviewerImage}
          initials={initialsFromName(p.reviewerName)}
          size={36}
          className="bg-mostaza-deep text-carbon text-xs"
          alt={`avatar de ${p.reviewerName}`}
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-mostaza text-carbon border-2 border-crema-deep flex items-center justify-center"
        >
          <IconStarFilled size={9} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-carbon leading-snug">
          <span className="font-medium">{p.reviewerName}</span>{" "}
          dejó una reseña de{" "}
          <span className="text-mostaza-deep">{"★".repeat(p.rating)}</span>{" "}
          en{" "}
          <span className="font-medium">{p.placeName}</span>
        </p>
        {p.snippet ? (
          <p className="text-xs text-tinta-suave mt-1 leading-relaxed line-clamp-2">
            «{p.snippet}»
          </p>
        ) : null}
        <p className="text-[10px] text-bronceado mt-1.5">
          hace {timeAgo(n.createdAt)}
        </p>
      </div>
    </Link>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "un momento";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hora" : `${hours} horas`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 día";
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  return `${Math.floor(days / 30)} meses`;
}
