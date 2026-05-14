import {
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconExternalLink,
  IconEye,
  IconMapPin,
  IconPhone,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import { getPlaceByIdForAdmin } from "@/server/services/places";
import {
  getStatsForPlace,
  type PlaceEventChannel,
} from "@/server/services/place-events";
import { hasActivePremium } from "@/server/services/subscriptions";

export const metadata = { title: "stats de mi local" };
export const dynamic = "force-dynamic";

type Params = { placeId: string };
type SearchParams = { dias?: string };

const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

const CHANNEL_META: Record<
  PlaceEventChannel,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  whatsapp: { label: "whatsapp", icon: IconBrandWhatsapp },
  instagram: { label: "instagram", icon: IconBrandInstagram },
  website: { label: "sitio web", icon: IconWorld },
  maps: { label: "mapa", icon: IconMapPin },
  phone: { label: "llamar", icon: IconPhone },
};

export default async function MiLocalStatsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { placeId } = await params;
  const { dias } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/mi-local/${placeId}/stats`);
  }

  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const place = await getPlaceByIdForAdmin(placeId);
  if (!place) notFound();

  const isPremium = await hasActivePremium(placeId);

  const parsedRange = Number(dias);
  const rangeDays: RangeOption = RANGE_OPTIONS.includes(parsedRange as RangeOption)
    ? (parsedRange as RangeOption)
    : 30;

  return (
    <div className="flex flex-col min-h-screen pb-12">
      <Header title="stats" backHref={`/${place.comuna}/${place.slug}`} />

      <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
        <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-xl text-carbon truncate">
              {place.name}
            </h1>
            <p className="text-[11px] text-bronceado mt-0.5">
              {place.comunaLabel} · {place.region}
            </p>
          </div>
          <Link
            href={`/${place.comuna}/${place.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs text-carbon bg-crema-deep border border-crema-edge hover:bg-white px-3 py-1.5 rounded-full transition-colors"
          >
            <IconExternalLink size={14} />
            ver ficha
          </Link>
        </header>

        {!isPremium ? (
          <UpgradeCta placeName={place.name} />
        ) : (
          <PremiumStats placeId={placeId} rangeDays={rangeDays} />
        )}
      </main>
    </div>
  );
}

function UpgradeCta({ placeName }: { placeName: string }) {
  return (
    <div className="bg-mostaza/10 border border-mostaza/40 rounded-xl p-5">
      <h2 className="font-display font-semibold text-lg text-carbon">
        stats premium
      </h2>
      <p className="text-sm text-tinta-suave mt-2 leading-relaxed">
        las stats de {placeName} están disponibles con el tier premium.
        verás visitas a la ficha, visitantes únicos, clicks por canal
        (whatsapp, instagram, llamar, sitio web, mapa) y la evolución
        diaria.
      </p>
      <p className="text-sm text-tinta-suave mt-3 leading-relaxed">
        para activar premium escribe a{" "}
        <a
          href="mailto:contacto@nexosoftware.cl"
          className="text-mostaza-deep font-medium underline"
        >
          contacto@nexosoftware.cl
        </a>
        .
      </p>
    </div>
  );
}

async function PremiumStats({
  placeId,
  rangeDays,
}: {
  placeId: string;
  rangeDays: RangeOption;
}) {
  const stats = await getStatsForPlace(placeId, rangeDays);
  const channels: PlaceEventChannel[] = [
    "whatsapp",
    "instagram",
    "phone",
    "website",
    "maps",
  ];
  const maxChannel = Math.max(
    1,
    ...channels.map((c) => stats.clicks.byChannel[c] ?? 0),
  );
  const maxDay = Math.max(1, ...stats.viewsByDay.map((d) => d.views));

  return (
    <div className="flex flex-col gap-5">
      <RangeTabs current={rangeDays} />

      <section className="grid grid-cols-3 gap-2">
        <Stat
          icon={<IconEye size={14} aria-hidden="true" />}
          label="visitas"
          value={stats.views.total}
        />
        <Stat
          icon={<IconUsers size={14} aria-hidden="true" />}
          label="únicos"
          value={stats.views.uniqueVisitors}
        />
        <Stat label="clicks" value={stats.clicks.total} />
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-bronceado font-medium mb-2">
          clicks por canal
        </h3>
        {stats.clicks.total === 0 ? (
          <p className="text-xs text-tinta-suave bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5">
            sin clicks en este rango.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {channels.map((ch) => {
              const value = stats.clicks.byChannel[ch] ?? 0;
              const pct = (value / maxChannel) * 100;
              const Icon = CHANNEL_META[ch].icon;
              return (
                <li
                  key={ch}
                  className="bg-white border border-crema-edge rounded-md px-3 py-2 flex items-center gap-3"
                >
                  <Icon size={14} className="text-bronceado shrink-0" />
                  <span className="text-xs text-carbon font-medium w-20 shrink-0">
                    {CHANNEL_META[ch].label}
                  </span>
                  <div className="flex-1 h-2 bg-crema-deep rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mostaza rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-carbon font-medium w-8 text-right shrink-0">
                    {value}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-bronceado font-medium mb-2">
          visitas por día
        </h3>
        {stats.viewsByDay.length === 0 ? (
          <p className="text-xs text-tinta-suave bg-crema-deep border border-crema-edge rounded-md px-3 py-2.5">
            sin visitas en este rango.
          </p>
        ) : (
          <div className="bg-white border border-crema-edge rounded-md px-3 py-3 flex items-end gap-1 h-32">
            {stats.viewsByDay.map((d) => {
              const h = (d.views / maxDay) * 100;
              return (
                <div
                  key={d.day}
                  className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                  title={`${d.day}: ${d.views}`}
                >
                  <div
                    className="w-full bg-mostaza rounded-sm"
                    style={{ height: `${h}%`, minHeight: 2 }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function RangeTabs({ current }: { current: RangeOption }) {
  return (
    <nav className="flex gap-2" aria-label="rango de fechas">
      {RANGE_OPTIONS.map((days) => {
        const isCurrent = days === current;
        return (
          <Link
            key={days}
            href={`?dias=${days}`}
            scroll={false}
            className={
              "text-xs font-medium px-3 py-1.5 rounded-full transition-colors " +
              (isCurrent
                ? "bg-mostaza text-carbon"
                : "bg-crema-deep border border-crema-edge text-tinta-suave hover:text-carbon")
            }
          >
            {days}d
          </Link>
        );
      })}
    </nav>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-crema-edge rounded-xl p-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-bronceado font-medium inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-display font-semibold text-2xl text-carbon">
        {value.toLocaleString("es-CL")}
      </span>
    </div>
  );
}
