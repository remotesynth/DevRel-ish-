import { db, RSVPs, AtRsvps, count, eq } from "astro:db";
import { isGoing } from "./at-events";

/** Count local RSVPs plus unique people going in indexed ATProto RSVP records. */
export async function totalRsvpCount(meetupId: string, eventUri: string | null): Promise<number> {
  const [local] = await db.select({ val: count() }).from(RSVPs).where(eq(RSVPs.meetupId, meetupId));
  if (!eventUri) return local?.val ?? 0;

  const network = await db
    .select({ did: AtRsvps.did, status: AtRsvps.status })
    .from(AtRsvps)
    .where(eq(AtRsvps.eventUri, eventUri));
  const goingDids = new Set(network.filter((r) => isGoing(r.status)).map((r) => r.did));
  return (local?.val ?? 0) + goingDids.size;
}
