import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getFollowing } from "@/lib/data/social";
import { BackLink } from "@/components/nav/back-link";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import { PAGE_SIZE, pageOf } from "../seguidores/person-line";
import { FollowingList } from "./following-list";

export const metadata: Metadata = { title: "Seguindo" };

/** Who you follow (W-141), newest first, each with the follow button (unfollow asks first). */
export default async function FollowingPage({ searchParams }: PageProps<"/app/profile/seguindo">) {
  const user = await requireUser();
  const page = pageOf((await searchParams).p);
  const following = await getFollowing(user.id, PAGE_SIZE * page);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <BackLink fallbackHref="/app/profile" />
      <Masthead kicker="Perfil" title="Seguindo" className="mt-2" />

      <section aria-labelledby="seguindo" className="mt-8">
        <SectionHead id="seguindo" label="Seguindo" count={plural(following.total, "pessoa", "pessoas")} />
        <FollowingList people={following.people} hasMore={following.hasMore} page={page} />
      </section>
    </div>
  );
}
