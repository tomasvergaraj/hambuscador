import { notFound } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { UserList } from "@/components/user/user-list";
import { getFollowing } from "@/server/services/follows";
import { getUserByUsername } from "@/server/services/users";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username} sigue a...` };
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const following = await getFollowing(user.id);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="siguiendo" subtitle={`@${user.username}`} backHref={`/u/${user.username}`} />

      <main className="px-4 pt-3 flex-1">
        <UserList
          items={following}
          empty={`@${user.username} no sigue a nadie todavía.`}
        />
      </main>

      <BottomNav />
    </div>
  );
}
