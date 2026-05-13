import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

import { createPicasListAction } from "../actions";
import { PicasForm } from "../picas-form";

export const metadata = { title: "admin · nueva picá" };

export default function NewPicasListPage() {
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
        <h1 className="font-display font-semibold text-xl text-carbon">
          nueva lista
        </h1>
      </header>

      <PicasForm
        mode="create"
        action={createPicasListAction}
        initial={{
          title: "",
          hook: "",
          intro: "",
          icon: "sparkles",
          maxItems: 10,
          sortOrder: 100,
          isActive: true,
          criteria: {},
        }}
      />
    </main>
  );
}
