import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { parsePickerQuery } from "@/lib/programming/exercise-facets";
import { pickerExercisesByIds, searchPickerExercises } from "../picker-data";

/**
 * The exercise picker's search, as a plain GET instead of a server action:
 * server actions run one at a time, so a search used to wait behind a
 * builder save still in flight, and a GET can be cancelled when the query
 * changes. Signed-in users only (Favoritos, Recentes and "Seu equipamento"
 * are theirs).
 *
 *   ?q=supino&muscle=peito&equipment=meu|halteres…&tab=todos|favoritos|recentes&page=2
 *   ?ids=a,b,c   the exercises with these ids (the builder's rows)
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;

  const ids = params.get("ids");
  if (ids !== null) {
    const items = await pickerExercisesByIds(ids.split(",").filter(Boolean));
    return NextResponse.json({ items, total: items.length, page: 1, hasMore: false }, { headers: PRIVATE });
  }

  const query = parsePickerQuery(params);
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { equipmentAccess: true },
  });
  const page = await searchPickerExercises(session.user.id, query, profile?.equipmentAccess ?? null);
  return NextResponse.json(page, { headers: PRIVATE });
}

/** Per user, and only briefly: a favorite added a moment ago must show. */
const PRIVATE = { "Cache-Control": "private, max-age=15" };
