import { db, RSVPs, AtRsvps, count, eq } from "astro:db";
import { isGoing } from "./at-events";

/** Count local RSVPs plus unique people going in indexed ATProto RSVP records. */
export async function totalRsvpCount(meetupId: string, eventUri: string | null): Promise<number> {
  const [local] = await db.select({ val: count() }).from(RSVPs).where(eq(RSVPs.meetupId, meetupId));
  return (local?.val ?? 0) + await networkGoingCount(eventUri);
}

/** Number of unique going RSVPs observed from the external network. */
export async function networkGoingCount(eventUri: string | null): Promise<number> {
  if (!eventUri) return 0;
  const network = await db
    .select({ did: AtRsvps.did, status: AtRsvps.status })
    .from(AtRsvps)
    .where(eq(AtRsvps.eventUri, eventUri));
  const goingDids = new Set(network.filter((r) => isGoing(r.status)).map((r) => r.did));
  return goingDids.size;
}
