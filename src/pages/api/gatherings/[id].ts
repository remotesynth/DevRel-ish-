import type { APIRoute } from "astro";
import { db, Meetups, Groups, RSVPs } from "astro:db";
import { eq, and } from "astro:db";

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

  const { title, description, date, time, venue, address, capacity } = body as Record<string, unknown>;

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
  if (venue !== undefined) {
    const v = String(venue).trim();
    if (!v) return json({ error: "Venue cannot be empty." }, 400);
    updates.venue = v;
  }
  if (address !== undefined) {
    updates.address = address ? String(address).trim() : null;
  }
  if (capacity !== undefined) {
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      return json({ error: "Capacity must be between 1 and 500." }, 400);
    }
    updates.capacity = cap;
  }

  await db.update(Meetups).set(updates).where(eq(Meetups.id, meetup.id));

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const meetup = await getOwnedMeetup(params.id!, locals.user.id);
  if (!meetup) return json({ error: "Gathering not found." }, 404);

  // Delete RSVPs first (no cascade in AstroDB)
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
