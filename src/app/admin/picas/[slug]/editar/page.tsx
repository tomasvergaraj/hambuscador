import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getActiveRegions, getAllComunas } from "@/lib/data";
import { getPicasListRowForAdmin } from "@/server/services/picas-lists";

import { updatePicasListAction, type ActionState } from "../../actions";
import { PicasForm } from "../../picas-form";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  return { title: `admin · editar ${slug}` };
}

export default async function EditPicasListPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [row, comunas, regions] = await Promise.all([
    getPicasListRowForAdmin(slug),
    getAllComunas(),
    getActiveRegions(),
  ]);
  if (!row) notFound();

  // Bind del slug a la action; firma queda (prev, fd).
  const action = async (prev: ActionState, fd: FormData) =>
    updatePicasListAction(slug, prev, fd);

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <header className="mb-4 flex items-center gap-2">
        <Link
          href="/admin/picas"
          aria-label="volver"
          className="w-8 h-8 inline-flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full"
        >
          <IconArrowLeft size={18} />
        </Link>
        <h1 className="font-display font-semibold text-xl text-carbon truncate">
          {row.title}
        </h1>
        <span className="text-[10px] uppercase tracking-wider font-medium bg-crema-edge/60 text-tinta-suave px-1.5 py-0.5 rounded">
          /{row.slug}
        </span>
      </header>

      <PicasForm
        mode="edit"
        action={action}
        comunas={comunas.map((c) => ({ slug: c.slug, label: c.label }))}
        regions={regions.map((r) => ({ label: r.label }))}
        initial={{
          slug: row.slug,
          title: row.title,
          hook: row.hook,
          intro: row.intro,
          icon: row.icon,
          maxItems: row.maxItems,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
          criteria: (row.criteria ?? {}) as PicasFormCriteria,
        }}
      />
    </main>
  );
}

type PicasFormCriteria = {
  cuisines?: string[];
  priceRanges?: string[];
  comunaSlug?: string;
  regionLabel?: string;
  minRating?: number;
  approvedWithinDays?: number;
  openAfterHour?: string;
};
