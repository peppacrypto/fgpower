"use client";

import { useState } from "react";
import { SectionHead } from "@/components/ui/section-head";
import { PersonRow, type PersonRowPerson } from "@/components/social/person-row";
import { plural } from "@/lib/utils/format";

/** A suggested person and why ("Treinando: GD 1"). */
export interface SuggestedRow {
  person: PersonRowPerson;
  meta: string;
}

/**
 * Descobrir's "Treinando o mesmo programa" and "Ativos esta semana", as the
 * visit's first render listed them (W-047). The server leaves out whoever the
 * viewer follows or asked, so a server re-render right after a Seguir here
 * (better-auth's session refresh re-renders the page inside a later action,
 * recovery R5) would take that row — and its "Seguindo" — away under the
 * finger. The lists stay put for the visit; the next visit or a reload shows
 * who is left.
 */
export function SuggestedPeople({ sameProgram, active }: { sameProgram: SuggestedRow[]; active: SuggestedRow[] }) {
  const [lists] = useState({ sameProgram, active });

  return (
    <>
      {lists.sameProgram.length > 0 ? (
        <section className="mt-8" aria-labelledby="mesmo-programa">
          <SectionHead
            id="mesmo-programa"
            label="Treinando o mesmo programa"
            count={plural(lists.sameProgram.length, "pessoa", "pessoas")}
          />
          <div className="mt-4 flex flex-col gap-2">
            {lists.sameProgram.map(({ person, meta }) => (
              <PersonRow key={person.id} person={person} meta={meta} />
            ))}
          </div>
        </section>
      ) : null}

      {lists.active.length > 0 ? (
        <section className="mt-8" aria-labelledby="ativos">
          <SectionHead id="ativos" label="Ativos esta semana" count={plural(lists.active.length, "pessoa", "pessoas")} />
          <div className="mt-4 flex flex-col gap-2">
            {lists.active.map(({ person, meta }) => (
              <PersonRow key={person.id} person={person} meta={meta} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
