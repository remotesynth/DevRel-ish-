import type { APIRoute } from "astro";
import { db, Meetups, Groups, eq } from "astro:db";
import { generateId } from "../../../lib/utils";
import { resolveCapacity, resolveLocation } from "../../../lib/gatherings";
import { enqueueGatheringPublication, reconcilePublicationOutbox } from "../../../lib/publication-outbox";

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

  const { title, description, date, time, endTime, mode, venue, joinUrl, address, capacity } =
    body as Record<string, unknown>;

  if (!title || !description || !date || !time) {
    return json({ error: "All required fields must be provided." }, 400);
  }

  const meetupDate = new Date(date as string);
  if (isNaN(meetupDate.getTime())) {
    return json({ error: "Invalid date." }, 400);
  }
  if (meetupDate < new Date()) {
    return json({ error: "Gathering date must be in the future." }, 400);
  }

  const where = resolveLocation({
    mode,
    venue: venue ? String(venue) : "",
    joinUrl: joinUrl ? String(joinUrl) : "",
    address: address ? String(address) : "",
  });
  if ("error" in where) return json({ error: where.error }, 400);

  const cap = resolveCapacity(capacity);
  if ("error" in cap) return json({ error: cap.error }, 400);

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
    mode: where.mode,
    venue: where.venue,
    joinUrl: where.joinUrl,
    address: where.address,
    capacity: cap.capacity,
    createdAt: now,
  });

  // Persist first, then make an immediate attempt. Any failure remains queued
  // for the scheduler rather than leaving this gathering local-only.
  const job = await enqueueGatheringPublication(group.id, meetupId);
  await reconcilePublicationOutbox({ ids: [job], limit: 1 });

  return json({ ok: true, id: meetupId }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
