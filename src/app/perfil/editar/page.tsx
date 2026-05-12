import { redirect } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { getUserById } from "@/server/services/users";

import { EditProfileForm } from "./edit-profile-form";

export const metadata = {
  title: "editar perfil",
};

export default async function EditProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/iniciar-sesion?next=/perfil/editar");
  }

  const user = await getUserById(session.user.id);
  if (!user) redirect("/iniciar-sesion");

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="editar perfil" backHref="/perfil" />

      <main className="px-4 pt-4 flex-1">
        <EditProfileForm
          name={user.name ?? session.user.name ?? "tú"}
          currentBio={user.bio}
          currentImage={user.image}
        />
      </main>

      <BottomNav />
    </div>
  );
}
