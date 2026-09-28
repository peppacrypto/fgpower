/**
 * How a user appears to other people, shared by every social loader. Pure
 * (a Prisma select and a mapper), so client-safe types can come from here too.
 */

/**
 * Prisma `select` for a user shown to other people. Pair with `toPublicUser`,
 * which puts the display name the user chose (Profile.displayName) in `name`
 * and falls back to the account (Google) name — so every public surface and
 * avatar shows "Carlinha", not "Carla Mendes".
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  image: true,
  profile: { select: { displayName: true } },
} as const;

export function toPublicUser(user: {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  profile: { displayName: string } | null;
}) {
  return {
    id: user.id,
    name: user.profile?.displayName?.trim() || user.name,
    username: user.username,
    image: user.image,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
