"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { unblockUser } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { useKeptRows } from "@/app/app/profile/seguidores/kept-rows";

interface BlockedPerson {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

/**
 * The blocked accounts, each with "Desbloquear" (the row then reads
 * "Desbloqueado" until the next visit, even through a server re-render that
 * no longer lists it). No link to their profiles: they stay hidden while
 * blocked. `notice` shows "Conta bloqueada." after blocking from a profile —
 * for this visit — and drops ?bloqueado=1 from the address so a reload
 * doesn't repeat it: through the router, without scrolling. (A bare
 * history.replaceState left Next a pending scroll to #bloqueados, which the
 * page's next server re-render — any save above — carried out.)
 */
export function BlockedList({ people, notice }: { people: BlockedPerson[]; notice: boolean }) {
  // Read once: a re-render of this page no longer has ?bloqueado=1.
  const [showNotice] = useState(notice);
  const rows = useKeptRows(people);
  const router = useRouter();

  useEffect(() => {
    if (!notice) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("bloqueado")) return;
    url.searchParams.delete("bloqueado");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [notice, router]);

  return (
    <div className="flex flex-col">
      {showNotice ? (
        <p
          role="status"
          className="mb-3 border-l-2 border-l-accent bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
        >
          Conta bloqueada.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Ninguém bloqueado. Para bloquear alguém, abra o perfil e toque em ⋯.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((p) => (
            <BlockedRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockedRow({ person }: { person: BlockedPerson }) {
  const [unblocked, setUnblocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLParagraphElement>(null);
  const handle = person.username ? `@${person.username}` : person.name;

  // The button is gone: the focus stays on this row (its name); the status says what happened.
  useEffect(() => {
    if (unblocked) nameRef.current?.focus();
  }, [unblocked]);

  function unblock() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => unblockUser(person.id));
      if (result.ok) setUnblocked(true);
      else setError(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-b-0" data-blocked-row>
      <span aria-hidden>
        <Avatar src={person.image} name={person.name} size={36} />
      </span>
      {/* basis-40: on a narrow phone the button wraps under the name instead of squeezing it. */}
      <div className="min-w-0 flex-1 basis-40">
        <p ref={nameRef} tabIndex={-1} className="truncate text-sm font-semibold outline-none">
          {person.name}
        </p>
        {person.username ? <p className="truncate font-mono text-xs text-muted">@{person.username}</p> : null}
      </div>
      <div className="ml-auto shrink-0">
        {unblocked ? null : (
          <Button variant="outline" size="sm" disabled={pending} onClick={unblock} aria-label={`Desbloquear ${handle}`}>
            {pending ? "Desbloqueando…" : "Desbloquear"}
          </Button>
        )}
        <span
          role="status"
          className={unblocked ? "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted" : "sr-only"}
        >
          {unblocked ? (
            <>
              Desbloqueado<span className="sr-only">: {handle}</span>
            </>
          ) : null}
        </span>
      </div>
      {error ? (
        <p role="alert" className="basis-full text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </li>
  );
}
