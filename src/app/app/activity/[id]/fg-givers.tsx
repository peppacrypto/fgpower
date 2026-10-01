import Link from "next/link";
import { Avatar } from "@/components/ui/misc";
import type { PublicUser } from "@/lib/data/social";
import { profileHref } from "@/lib/social/links";

/** Avatars in the stack. */
const MAX_AVATARS = 6;
/** Names spelled out before "e mais N". */
const MAX_NAMES = 2;

/**
 * Who gave FG (W-143): up to six overlapping avatars, each opening that
 * person's profile, and "FG de Ana, Bruno e mais 4". The number comes from
 * the activity's count, so people the viewer can't see (blocked, banned)
 * are counted without being named. Nothing at 0.
 */
export function FgGivers({ givers, total }: { givers: PublicUser[]; total: number }) {
  if (total <= 0 || givers.length === 0) return null;
  const named = givers.slice(0, MAX_NAMES).map((g) => g.name);
  const rest = Math.max(0, total - named.length);
  const text =
    rest > 0 ? `FG de ${named.join(", ")} e mais ${rest}` : named.length === 2 ? `FG de ${named[0]} e ${named[1]}` : `FG de ${named[0]}`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <ul className="flex items-center" aria-label="Quem deu FG">
        {givers.slice(0, MAX_AVATARS).map((g, i) => (
          <li key={g.id} className={i === 0 ? "-ml-2" : "-ml-5"}>
            {g.username ? (
              <Link
                href={profileHref(g.username)}
                aria-label={`Perfil de ${g.name}`}
                className="relative flex size-11 items-center justify-center rounded-full hover:z-10 focus-visible:z-10"
              >
                <span aria-hidden className="rounded-full ring-2 ring-background">
                  <Avatar src={g.image} name={g.name} size={28} />
                </span>
              </Link>
            ) : (
              <span aria-hidden className="flex size-11 items-center justify-center">
                <span className="rounded-full ring-2 ring-background">
                  <Avatar src={g.image} name={g.name} size={28} />
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="min-w-0 text-sm text-muted">{text}</p>
    </div>
  );
}
