// Publishing gatherings to the organizer's PDS.
//
// This lives here because four call sites need it: the two API routes and the
// two dashboard pages. Until this module existed only the API routes wrote to
// the PDS — and nothing in the UI called them — so gatherings created through
// the dashboard never reached the network at all.

import { db, Meetups, Groups, eq } from "astro:db";
import { getPdsSession, pdsCreate, pdsPut } from "./atproto-pds";
import {
  EVENT_NSID,
  EventStatus,
  buildAddress,
  buildCalendarEvent,
  buildEndsAt,
  buildStartsAt,
  gatheringUrl,
} from "./atproto-records";

export const EVENT_META_NSID = "com.devrelish.event.meta";

type GatheringRow = typeof Meetups.$inferSelect;
type GroupRow = typeof Groups.$inferSelect;

/**
 * The `community.lexicon.calendar.event` body for a gathering.
 *
 * A gathering can carry its own city/country (a group's meetup at a conference,
 * say), so those win over the group's home location when present.
 */
function eventRecordFor(meetup: GatheringRow, group: GroupRow) {
  return buildCalendarEvent({
    name: meetup.title,
    description: meetup.description,
    startsAt: buildStartsAt(meetup.date, meetup.time),
    endsAt: buildEndsAt(meetup.date, meetup.time, meetup.endTime),
    createdAt: meetup.createdAt.toISOString(),
    location: buildAddress({
      name: meetup.venue,
      street: meetup.address,
      locality: meetup.city ?? group.city,
      region: group.region,
      country: meetup.country ?? group.country,
    }),
    canonicalUrl: gatheringUrl(meetup.id),
    status: meetup.status === "canceled" ? EventStatus.cancelled : EventStatus.scheduled,
    rsvpExpected: meetup.status !== "canceled",
  });
}

/** The DevRel(ish) extension record: which group this event belongs to, plus capacity. */
function metaRecordFor(
  meetup: GatheringRow,
  group: GroupRow,
  event: { uri: string; cid: string }
) {
  return {
    event: { uri: event.uri, cid: event.cid },
    group: { uri: group.atUri!, cid: group.atCid! },
    capacity: meetup.capacity,
    ...(meetup.eventContext ? { eventContext: meetup.eventContext } : {}),
    createdAt: meetup.createdAt.toISOString(),
  };
}

/**
 * Publish a newly created gathering to the organizer's PDS.
 *
 * Best-effort by design: the gathering already exists locally, and a PDS that's
 * briefly unreachable shouldn't cost the organizer their work. Returns whether
 * the write landed so callers can surface it.
 */
export async function publishGathering(
  did: string,
  meetup: GatheringRow,
  group: GroupRow
): Promise<boolean> {
  const session = await getPdsSession(did);
  if (!session) return false;

  try {
    const event = await pdsCreate(session, EVENT_NSID, eventRecordFor(meetup, group));

    // The meta record holds strongRefs to both the event and the group, so it
    // can only be written once the group itself is on the network.
    let metaUri: string | null = null;
    let metaCid: string | null = null;
    if (group.atUri && group.atCid) {
      const meta = await pdsCreate(session, EVENT_META_NSID, metaRecordFor(meetup, group, event));
      metaUri = meta.uri;
      metaCid = meta.cid;
    }

    await db
      .update(Meetups)
      .set({
        atEventUri: event.uri,
        atEventCid: event.cid,
        ...(metaUri ? { atMetaUri: metaUri, atMetaCid: metaCid } : {}),
      })
      .where(eq(Meetups.id, meetup.id));

    return true;
  } catch (err) {
    console.error("[gatherings] PDS publish failed:", err);
    return false;
  }
}

/**
 * Push local edits to the already-published record.
 *
 * `putRecord` replaces the record wholesale, so `eventRecordFor` rebuilds every
 * field — including `status`, which must survive an edit to a cancelled event.
 *
 * Only the repo that owns a record can update it, and `pdsPut` always targets
 * `session.did`. An admin editing someone else's gathering would otherwise write
 * into their own repo, so the URI's DID has to match the caller.
 */
export async function syncGathering(
  did: string,
  meetup: GatheringRow,
  group: GroupRow
): Promise<boolean> {
  if (!meetup.atEventUri) return false;
  if (meetup.atEventUri.split("/")[2] !== did) return false;

  const session = await getPdsSession(did);
  if (!session) return false;

  try {
    const event = await pdsPut(session, meetup.atEventUri, eventRecordFor(meetup, group));
    await db.update(Meetups).set({ atEventCid: event.cid }).where(eq(Meetups.id, meetup.id));

    if (meetup.atMetaUri && group.atUri && group.atCid) {
      const meta = await pdsPut(
        session,
        meetup.atMetaUri,
        metaRecordFor(meetup, group, { uri: event.uri, cid: event.cid })
      );
      await db.update(Meetups).set({ atMetaCid: meta.cid }).where(eq(Meetups.id, meetup.id));
    }

    return true;
  } catch (err) {
    console.error("[gatherings] PDS sync failed:", err);
    return false;
  }
}

/**
 * Publish if the gathering has never reached the network, otherwise update.
 * Lets callers stop caring which case they're in — including gatherings created
 * before the dashboard wrote to the PDS at all.
 */
export async function publishOrSyncGathering(
  did: string,
  meetup: GatheringRow,
  group: GroupRow
): Promise<boolean> {
  return meetup.atEventUri
    ? syncGathering(did, meetup, group)
    : publishGathering(did, meetup, group);
}
