// Publishing gatherings to the dedicated group publisher's PDS.
//
// This lives here because four call sites need it: the two API routes and the
// two dashboard pages. Until this module existed only the API routes wrote to
// the PDS — and nothing in the UI called them — so gatherings created through
// the dashboard never reached the network at all.

import { db, Meetups, Groups, eq } from "astro:db";
import { getPdsSession, pdsPut } from "./atproto-pds";
import {
  EVENT_NSID,
  EventStatus,
  buildAddress,
  buildCalendarEvent,
  buildEndsAt,
  buildStartsAt,
  buildUriLocation,
  eventModeFor,
  gatheringUrl,
} from "./atproto-records";

export const EVENT_META_NSID = "tech.devrelish.event.meta";

export { normalizeMode, normalizeJoinUrl, resolveLocation, resolveCapacity, GATHERING_MODES } from "./gathering-input";
export type { Mode } from "./gathering-input";

type GatheringRow = typeof Meetups.$inferSelect;
type GroupRow = typeof Groups.$inferSelect;

/**
 * The `community.lexicon.calendar.event` body for a gathering.
 *
 * A gathering can carry its own city/country (a group's meetup at a conference,
 * say), so those win over the group's home location when present.
 */
function eventRecordFor(meetup: GatheringRow, group: GroupRow) {
  const url = gatheringUrl(meetup.id);
  const online = meetup.mode === "virtual" || meetup.mode === "hybrid";

  return buildCalendarEvent({
    name: meetup.title,
    description: meetup.description,
    startsAt: buildStartsAt(meetup.date, meetup.time, group.timezone),
    endsAt: buildEndsAt(meetup.date, meetup.time, meetup.endTime, group.timezone),
    createdAt: meetup.createdAt.toISOString(),
    // A virtual gathering has no address to publish; a hybrid one has both.
    location: meetup.venue
      ? buildAddress({
          name: meetup.venue,
          street: meetup.address,
          locality: meetup.city ?? group.city,
          region: group.region,
          country: meetup.country ?? group.country,
        })
      : null,
    // Deliberately the RSVP page, not meetup.joinUrl — see buildUriLocation.
    uriLocation: online ? buildUriLocation(url, "Online — RSVP for the joining link") : null,
    mode: eventModeFor(meetup.mode),
    canonicalUrl: url,
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
    // The lexicon says to omit capacity for unlimited, so a null must not be
    // written through as a null.
    ...(meetup.capacity != null ? { capacity: meetup.capacity } : {}),
    ...(meetup.eventContext ? { eventContext: meetup.eventContext } : {}),
    createdAt: meetup.createdAt.toISOString(),
  };
}

/**
 * Publish a newly created gathering to the group's PDS.
 *
 * Best-effort convenience wrapper. New application paths enqueue the durable
 * outbox instead; this is retained for callers that only need an immediate
 * attempt. Returns whether the write landed.
 */
async function writeNewGathering(meetup: GatheringRow, group: GroupRow): Promise<void> {
  if (!group.publisherDid) throw new Error("The group publisher account is not connected");
  const session = await getPdsSession(group.publisherDid);
  if (!session) throw new Error("The group publisher account needs to reauthorize");

  // A deterministic rkey prevents a timeout between the PDS write and the DB
  // update from producing a duplicate event on retry.
  const eventUri = `at://${group.publisherDid}/${EVENT_NSID}/gathering-${meetup.id}`;
  const event = await pdsPut(session, eventUri, eventRecordFor(meetup, group));
  await db.update(Meetups).set({ atEventUri: event.uri, atEventCid: event.cid }).where(eq(Meetups.id, meetup.id));

  if (group.atUri && group.atCid) {
    const metaUri = `at://${group.publisherDid}/${EVENT_META_NSID}/gathering-${meetup.id}`;
    const meta = await pdsPut(session, metaUri, metaRecordFor(meetup, group, event));
    await db.update(Meetups).set({ atMetaUri: meta.uri, atMetaCid: meta.cid }).where(eq(Meetups.id, meetup.id));
  }
}

export async function reconcileGatheringPublication(meetup: GatheringRow, group: GroupRow): Promise<void> {
  if (meetup.adopted) return;
  if (!group.publisherDid) throw new Error("The group publisher account is not connected");

  // Records authored before the dedicated group publisher model cannot be
  // safely updated. Publish a new canonical record under the group account.
  if (!meetup.atEventUri || meetup.atEventUri.split("/")[2] !== group.publisherDid) {
    await writeNewGathering(meetup, group);
    return;
  }

  const session = await getPdsSession(group.publisherDid);
  if (!session) throw new Error("The group publisher account needs to reauthorize");
  const event = await pdsPut(session, meetup.atEventUri, eventRecordFor(meetup, group));
  await db.update(Meetups).set({ atEventCid: event.cid }).where(eq(Meetups.id, meetup.id));

  if (group.atUri && group.atCid) {
    const metaUri = meetup.atMetaUri?.split("/")[2] === group.publisherDid
      ? meetup.atMetaUri
      : `at://${group.publisherDid}/${EVENT_META_NSID}/gathering-${meetup.id}`;
    const meta = await pdsPut(session, metaUri, metaRecordFor(meetup, group, event));
    await db.update(Meetups).set({ atMetaUri: meta.uri, atMetaCid: meta.cid }).where(eq(Meetups.id, meetup.id));
  }
}

export async function publishGathering(meetup: GatheringRow, group: GroupRow): Promise<boolean> {
  try {
    await reconcileGatheringPublication(meetup, group);
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
export async function syncGathering(meetup: GatheringRow, group: GroupRow): Promise<boolean> {
  try {
    await reconcileGatheringPublication(meetup, group);
    return true;
  } catch (err) {
    console.error("[gatherings] PDS sync failed:", err);
    return false;
  }
}

/**
 * Publish if the gathering has never reached the network, otherwise update.
 * Lets callers stop caring which case they're in — including gatherings created
 * before the dashboard wrote to the PDS at all. Adopted events fall through to
 * `syncGathering`, which declines to touch them.
 */
export async function publishOrSyncGathering(meetup: GatheringRow, group: GroupRow): Promise<boolean> {
  return meetup.atEventUri
    ? syncGathering(meetup, group)
    : publishGathering(meetup, group);
}
