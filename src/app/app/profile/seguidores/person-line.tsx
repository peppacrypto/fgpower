import Link from "next/link";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { profileHref } from "@/lib/social/links";
import { plural } from "@/lib/utils/format";

/**
 * One person in the account's own lists (Seguidores, Seguindo, Solicitações):
 * face, name and @handle linking to their profile, and the row's buttons on
 * the right — they wrap under the name on a narrow phone, never over it, and
 * wrap among themselves (with an error line) rather than past the screen's
 * edge. The buttons are client islands.
 */
export function PersonLine({
  person,
  children,
}: {
  person: { id: string; name: string; username: string | null; image: string | null };
  children?: React.ReactNode;
}) {
  const who = (
    <>
      <span aria-hidden className="shrink-0">
        <Avatar src={person.image} name={person.name} size={40} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{person.name}</span>
        {person.username ? <span className="block truncate font-mono text-xs text-muted">@{person.username}</span> : null}
      </span>
    </>
  );
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-3 has-[[data-removed]]:opacity-60"
      data-person={person.username ?? person.id}
    >
      {person.username ? (
        <Link
          href={profileHref(person.username)}
          data-row-person
          className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-3 hover:underline"
        >
          {who}
        </Link>
      ) : (
        <div data-row-person tabIndex={-1} className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-3 outline-none">
          {who}
        </div>
      )}
      {children ? <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">{children}</div> : null}
    </li>
  );
}

/**
 * After a row's button went away (a follower removed, a request answered):
 * the focus stays on that row — its person — instead of dropping to the page,
 * while the row's status region says what happened. `from` is inside the row.
 */
export function focusRowPerson(from: HTMLElement | null) {
  (from?.closest("li")?.querySelector<HTMLElement>("[data-row-person]") ?? from)?.focus();
}

/** People per "Carregar mais" step (server-rendered ?p= pages: back/forward keep the place), and how far it goes. */
export const PAGE_SIZE = 50;
export const MAX_PAGES = 10;

/** The page number in ?p= (1–MAX_PAGES; anything else is 1). */
export function pageOf(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGES ? n : 1;
}

/** "Carregar mais" (the next ?p=), or where the list stops. */
export function MoreLink({ shown, hasMore, page, href }: { shown: number; hasMore: boolean; page: number; href: string }) {
  return (
    <div className="mt-4">
      <p role="status" className="sr-only">
        Mostrando {plural(shown, "pessoa", "pessoas")}
      </p>
      {hasMore && page < MAX_PAGES ? (
        <Button variant="outline" asChild className="w-full">
          <Link href={`${href}?p=${page + 1}`} scroll={false} replace>
            Carregar mais
          </Link>
        </Button>
      ) : hasMore ? (
        <p className="text-center text-xs text-muted">Mostrando as {plural(shown, "pessoa mais recente", "pessoas mais recentes")}.</p>
      ) : null}
    </div>
  );
}
