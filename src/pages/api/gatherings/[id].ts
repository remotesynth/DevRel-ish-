import type { APIRoute } from "astro";
import { db, Meetups, Groups, RSVPs, eq, and } from "astro:db";
import { resolveCapacity, resolveLocation } from "../../../lib/gatherings";
import { enqueueGatheringDeletion, enqueueGatheringPublication, reconcilePublicationOutbox } from "../../../lib/publication-outbox";

export const prerender = false;

async function getOwnedMeetup(meetupId: string, userId: string) {
  const [group] = await db
    .select()
    .from(Groups)
    .where(eq(Groups.managerId, userId));
  if (!group) return null;

  const [meetup] = await db
    .select()
    .from(Meetups)
    .where(and(eq(Meetups.id, meetupId), eq(Meetups.groupId, group.id)));
  return meetup ?? null;
}


export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const meetup = await getOwnedMeetup(params.id!, locals.user.id);
  if (!meetup) return json({ error: "Gathering not found." }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { title, description, date, time, endTime, mode, venue, joinUrl, address, capacity } =
    body as Record<string, unknown>;

  const updates: Partial<typeof meetup> = {};

  if (title !== undefined) {
    const t = String(title).trim();
    if (!t) return json({ error: "Title cannot be empty." }, 400);
    updates.title = t;
  }
  if (description !== undefined) {
    const d = String(description).trim();
    if (!d) return json({ error: "Description cannot be empty." }, 400);
    updates.description = d;
  }
  if (date !== undefined) {
    const meetupDate = new Date(date as string);
    if (isNaN(meetupDate.getTime())) {
      return json({ error: "Invalid date." }, 400);
    }
    if (meetupDate < new Date()) {
      return json({ error: "Gathering date must be in the future." }, 400);
    }
    updates.date = meetupDate;
  }
  if (time !== undefined) {
    const t = String(time).trim();
    if (!t) return json({ error: "Time cannot be empty." }, 400);
    updates.time = t;
  }
  if (endTime !== undefined) {
    const e = endTime ? String(endTime).trim() : "";
    if (e && !/^\d{2}:\d{2}$/.test(e)) return json({ error: "Invalid end time." }, 400);
    updates.endTime = e || null;
  }
  // Mode, venue and joining link constrain each other, so a change to any one
  // of them is re-resolved against the stored row rather than applied alone —
  // otherwise switching to virtual could leave the old venue behind.
  if (mode !== undefined || venue !== undefined || joinUrl !== undefined || address !== undefined) {
    const where = resolveLocation({
      mode: mode !== undefined ? mode : meetup.mode,
      venue: venue !== undefined ? String(venue) : meetup.venue ?? "",
      joinUrl: joinUrl !== undefined ? String(joinUrl) : meetup.joinUrl ?? "",
      address: address !== undefined ? String(address) : meetup.address ?? "",
    });
    if ("error" in where) return json({ error: where.error }, 400);
    updates.mode = where.mode;
    updates.venue = where.venue;
    updates.joinUrl = where.joinUrl;
    updates.address = where.address;
  }
  if (capacity !== undefined) {
    const cap = resolveCapacity(capacity);
    if ("error" in cap) return json({ error: cap.error }, 400);
    updates.capacity = cap.capacity;
  }

  await db.update(Meetups).set(updates).where(eq(Meetups.id, meetup.id));

  // A successful local edit is durable publication work, even if the PDS is
  // unavailable during this request.
  const job = await enqueueGatheringPublication(meetup.groupId, meetup.id);
  await reconcilePublicationOutbox({ ids: [job], limit: 1 });

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const meetup = await getOwnedMeetup(params.id!, locals.user.id);
  if (!meetup) return json({ error: "Gathering not found." }, 404);

  const [group] = await db.select().from(Groups).where(eq(Groups.id, meetup.groupId));
  const job = await enqueueGatheringDeletion(meetup.groupId, meetup, group?.publisherDid ?? null);
  if (job) await reconcilePublicationOutbox({ ids: [job], limit: 1 });

  await db.delete(RSVPs).where(eq(RSVPs.meetupId, meetup.id));
  await db.delete(Meetups).where(eq(Meetups.id, meetup.id));

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
