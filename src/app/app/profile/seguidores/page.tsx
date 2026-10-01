import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getFollowers, getPendingFollowRequests } from "@/lib/data/social";
import { BackLink } from "@/components/nav/back-link";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import { PAGE_SIZE, pageOf } from "./person-line";
import { FollowerList, RequestList } from "./people-lists";

export const metadata: Metadata = { title: "Seguidores" };

/**
 * Your followers (W-141): requests waiting for an answer first, then everyone
 * who follows you, newest first — each with "Seguir de volta" (when you
 * don't follow them) and "Remover". Only your own list: other people's
 * followers aren't shown anywhere.
 */
export default async function FollowersPage({ searchParams }: PageProps<"/app/profile/seguidores">) {
  const user = await requireUser();
  const page = pageOf((await searchParams).p);
  const [requests, followers] = await Promise.all([getPendingFollowRequests(user.id), getFollowers(user.id, PAGE_SIZE * page)]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <BackLink fallbackHref="/app/profile" />
      <Masthead kicker="Perfil" title="Seguidores" className="mt-2" />

      <RequestList requests={requests.map((r) => ({ id: r.id, requester: r.requester }))} />

      <section aria-labelledby="seguidores" className="mt-8">
        <SectionHead id="seguidores" label="Seguidores" count={plural(followers.total, "pessoa", "pessoas")} />
        <FollowerList people={followers.people} hasMore={followers.hasMore} page={page} />
      </section>
    </div>
  );
}
