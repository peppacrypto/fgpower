import Link from "next/link";
import { Avatar } from "@/components/ui/misc";
import { profileHref } from "@/lib/social/links";
import { FollowButton, type FollowRelation } from "./follow-button";

/** What a row shows of a person (lib/social/people PersonRowData fits). */
export interface PersonRowPerson {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  isPublicAccount: boolean;
  relation: FollowRelation;
}

/**
 * One person in a list (Descobrir's results and suggestions): the whole row
 * opens their profile — a stretched link whose name is the display name and
 * the @handle — and Seguir sits above it with its own tap. `meta` is the mono
 * line saying why they're here ("Treinando: GD 1").
 */
export function PersonRow({ person, meta }: { person: PersonRowPerson; meta?: string | null }) {
  return (
    // On a narrow phone a long state ("Solicitação enviada") wraps under the name instead of squeezing it.
    <div className="reg-frame is-link relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span aria-hidden className="shrink-0">
        <Avatar src={person.image} name={person.name} size={40} />
      </span>
      <div className="min-w-[7.5rem] flex-1 basis-[7.5rem]">
        <Link
          href={profileHref(person.username)}
          className="group block after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
        >
          <span className="block truncate text-sm font-semibold group-hover:text-accent">{person.name}</span>
          <span className="block truncate font-mono text-xs text-muted">@{person.username}</span>
        </Link>
        {meta ? (
          <p className="mt-0.5 line-clamp-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted wrap-break-word">
            {meta}
          </p>
        ) : null}
        {person.bio ? <p className="mt-0.5 truncate text-xs text-muted">{person.bio}</p> : null}
      </div>
      <div className="relative z-10 ml-auto max-w-full shrink-0">
        <FollowButton
          targetUserId={person.id}
          username={person.username}
          name={person.name}
          initialRelation={person.relation}
          isPrivate={!person.isPublicAccount}
          size="sm"
        />
      </div>
    </div>
  );
}
