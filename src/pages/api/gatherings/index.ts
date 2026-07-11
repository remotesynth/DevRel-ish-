import type { APIRoute } from "astro";
import { db, Meetups, Groups, eq } from "astro:db";
import { generateId } from "../../../lib/utils";
import { getPdsSession, pdsCreate } from "../../../lib/atproto-pds";

export const prerender = false;

// Combine the date (Date object) and time string ("HH:MM") into an ISO datetime.
// Treated as UTC; timezone-aware scheduling is a future improvement.
function buildStartsAt(date: Date, timeStr: string): string {
  const dateStr = date.toISOString().split("T")[0]; // "YYYY-MM-DD"
  return `${dateStr}T${timeStr}:00.000Z`;
}

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

  const { title, description, date, time, venue, address, capacity } = body as Record<string, unknown>;

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

  const meetupId = generateId();
  const now = new Date();
  const startsAt = buildStartsAt(meetupDate, String(time));

  // Insert to local DB first so the gathering exists even if PDS write fails
  await db.insert(Meetups).values({
    id: meetupId,
    groupId: group.id,
    title: String(title).trim(),
    description: String(description).trim(),
    date: meetupDate,
    time: String(time),
    venue: String(venue).trim(),
    address: address ? String(address).trim() : null,
    capacity: cap,
    createdAt: now,
  });

  // Write to PDS (best-effort; failure is logged but does not roll back the local insert)
  const session = await getPdsSession(locals.user.did);
  if (session) {
    try {
      const locationObj = {
        $type: "community.lexicon.location.address",
        name: String(venue).trim(),
        ...(address ? { street: String(address).trim() } : {}),
        ...(group.city ? { city: group.city } : {}),
        ...(group.country ? { country: group.country } : {}),
      };

      const eventResult = await pdsCreate(session, "community.lexicon.calendar.event", {
        name: String(title).trim(),
        startsAt,
        description: String(description).trim(),
        locations: [locationObj],
        createdAt: now.toISOString(),
      });

      // com.devrelish.event.meta requires a strongRef to both the event and the group.
      // Only create it if the group has been published to ATProto.
      let metaUri: string | null = null;
      let metaCid: string | null = null;

      if (group.atUri && group.atCid) {
        const metaResult = await pdsCreate(session, "com.devrelish.event.meta", {
          event: { uri: eventResult.uri, cid: eventResult.cid },
          group: { uri: group.atUri, cid: group.atCid },
          capacity: cap,
          createdAt: now.toISOString(),
        });
        metaUri = metaResult.uri;
        metaCid = metaResult.cid;
      }

      await db.update(Meetups)
        .set({
          atEventUri: eventResult.uri,
          atEventCid: eventResult.cid,
          ...(metaUri ? { atMetaUri: metaUri, atMetaCid: metaCid } : {}),
        })
        .where(eq(Meetups.id, meetupId));
    } catch (err) {
      console.error("[gatherings/create] PDS write failed:", err);
    }
  }

  return json({ ok: true, id: meetupId }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
