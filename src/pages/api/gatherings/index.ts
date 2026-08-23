import type { APIRoute } from "astro";
import { db, Meetups, Groups, eq } from "astro:db";
import { generateId } from "../../../lib/utils";
import { publishGathering } from "../../../lib/gatherings";

export const prerender = false;


export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized." }, 401);
  }

  const [group] = await db
    .select()
    .from(Groups)
    .where(eq(Groups.managerId, locals.user.id));

  if (!group) {
    return json({ error: "No group associated with your account." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { title, description, date, time, endTime, venue, address, capacity } = body as Record<string, unknown>;

  if (!title || !description || !date || !time || !venue || !capacity) {
    return json({ error: "All required fields must be provided." }, 400);
  }

  const meetupDate = new Date(date as string);
  if (isNaN(meetupDate.getTime())) {
    return json({ error: "Invalid date." }, 400);
  }
  if (meetupDate < new Date()) {
    return json({ error: "Gathering date must be in the future." }, 400);
  }

  const cap = Number(capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
    return json({ error: "Capacity must be between 1 and 500." }, 400);
  }

  const timeRe = /^\d{2}:\d{2}$/;
  const endTimeStr = endTime ? String(endTime).trim() : "";
  if (endTimeStr && !timeRe.test(endTimeStr)) {
    return json({ error: "Invalid end time." }, 400);
  }

  const meetupId = generateId();
  const now = new Date();

  // Insert to local DB first so the gathering exists even if PDS write fails
  await db.insert(Meetups).values({
    id: meetupId,
    groupId: group.id,
    title: String(title).trim(),
    description: String(description).trim(),
    date: meetupDate,
    time: String(time),
    endTime: endTimeStr || null,
    venue: String(venue).trim(),
    address: address ? String(address).trim() : null,
    capacity: cap,
    createdAt: now,
  });

  // Publish to the organizer's PDS. Best-effort: the gathering already exists
  // locally, and one unreachable PDS shouldn't fail the request.
  const [saved] = await db.select().from(Meetups).where(eq(Meetups.id, meetupId));
  if (saved) await publishGathering(locals.user.did, saved, group);

  return json({ ok: true, id: meetupId }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
