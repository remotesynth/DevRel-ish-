import { db, RSVPs, sql } from "astro:db";

export type ReservationResult = "created" | "duplicate" | "full";

/**
 * Atomically insert a local RSVP if its email has not registered and a local
 * seat remains. A single SQLite statement is serialized by Turso, unlike the
 * former count-then-insert sequence where concurrent requests could overbook.
 *
 * Network RSVPs are eventually consistent, so callers reserve only the
 * capacity left after the current network-going count.
 */
export async function reserveLocalRsvp(input: {
  id: string;
  meetupId: string;
  name: string;
  email: string;
  jobTitle: string;
  company: string;
  cancelToken?: string | null;
  availableLocalSeats: number | null;
}): Promise<ReservationResult> {
  if (input.availableLocalSeats != null && input.availableLocalSeats <= 0) return "full";

  const seatPredicate = input.availableLocalSeats == null
    ? sql`1`
    : sql`(SELECT count(*) FROM ${RSVPs} WHERE ${RSVPs.meetupId} = ${input.meetupId}) < ${input.availableLocalSeats}`;

  const result = await db.run(sql`
    INSERT INTO ${RSVPs} (${RSVPs.id}, ${RSVPs.meetupId}, ${RSVPs.name}, ${RSVPs.email}, ${RSVPs.jobTitle}, ${RSVPs.company}, ${RSVPs.cancelToken}, ${RSVPs.createdAt})
    SELECT ${input.id}, ${input.meetupId}, ${input.name}, ${input.email}, ${input.jobTitle}, ${input.company}, ${input.cancelToken ?? null}, ${new Date()}
    WHERE NOT EXISTS (
      SELECT 1 FROM ${RSVPs}
      WHERE ${RSVPs.meetupId} = ${input.meetupId} AND ${RSVPs.email} = ${input.email}
    ) AND ${seatPredicate}
  `);
  if (result.rowsAffected === 1) return "created";

  const [duplicate] = await db.select({ id: RSVPs.id }).from(RSVPs)
    .where(sql`${RSVPs.meetupId} = ${input.meetupId} AND ${RSVPs.email} = ${input.email}`);
  return duplicate ? "duplicate" : "full";
}
