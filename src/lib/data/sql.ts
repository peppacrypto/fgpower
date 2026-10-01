import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * São Paulo calendar math in SQL, equal to lib/training/day-rotation's
 * dayNumberOf / mondayOf: a workout finished 22:30 on a Sunday in São Paulo
 * (01:30 UTC on Monday) lands on that Sunday and in that week. `col` is a
 * `timestamp(3)` column holding UTC (Prisma's DateTime), e.g.
 * Prisma.sql`s."finishedAt"`.
 */

/** Days since 1970-01-01 of the São Paulo date of `col`. */
export function spDayNo(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((((${col}) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date - DATE '1970-01-01')::int`;
}

/** Days since 1970-01-01 of the Monday of the São Paulo week holding `col`. */
export function spMondayNo(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((date_trunc('week', ((${col}) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'))::date - DATE '1970-01-01')::int`;
}
