import type { APIRoute } from "astro";
import { db, Meetups, Groups, eq } from "astro:db";
import { generateId } from "../../../lib/utils";
import { getPdsSession, pdsCreate } from "../../../lib/atproto-pds";
import { EVENT_NSID } from "../../../lib/atproto-records";
import { EVENT_META_NSID } from "../../../lib/gatherings";
import { coerceToAtUri, getRecord, listRecords, parseAtUri } from "../../../lib/atproto-repo";

export const prerender = false;

/**
 * Bringing existing Atmosphere events into DevRel(ish).
 *
 * Smoke Signal, atmo.rsvp, and OpenMeet all write
 * `community.lexicon.calendar.event` into the *user's own repo*, so listing that
 * one collection returns their events no matter which app created them. No
 * per-app scraping, no API keys.
 *
 * Adoption never duplicates the event record. The existing record stays where it
 * is and keeps its at:// URI; we add a local row pointing at it plus a
 * `com.devrelish.event.meta` linking it to the group. That's what the meta
 * record is for.
 */

export interface DiscoveredEvent {
  uri: string;
  cid: string;
  name: string;
  startsAt: string | null;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  cancelled: boolean;
  alreadyAdopted: boolean;
}

/** GET — list the calendar events already sitting in the organizer's repo. */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const records = await listRecords(locals.user.did, EVENT_NSID);
  const adopted = await adoptedUriSet();

  const events = records
    .map((r) => toDiscovered(r.uri, r.cid, r.value, adopted))
    .sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));

  return json({ events });
};

/**
 * POST — adopt events into the caller's group.
 *
 * Body is either `{ uris: string[] }` (from the listing) or `{ url: string }`
 * for a pasted at:// URI or recognised app URL.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const [group] = locals.user.groupId
    ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
    : [];
  if (!group) return json({ error: "No group associated with your account." }, 403);

  let body: { uris?: unknown; url?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  let uris: string[] = [];

  if (typeof body.url === "string" && body.url.trim()) {
    const coerced = coerceToAtUri(body.url);
    if (!coerced) {
      return json(
        {
          error:
            "That doesn't look like an event we can read. Paste the event's at:// URI, " +
            "or a Smoke Signal event URL.",
        },
        400
      );
    }
    uris = [coerced];
  } else if (Array.isArray(body.uris)) {
    uris = body.uris.filter((u): u is string => typeof u === "string" && u.startsWith("at://"));
  }

  if (uris.length === 0) return json({ error: "No events selected." }, 400);
  if (uris.length > 50) return json({ error: "Import at most 50 events at a time." }, 400);

  const adopted = await adoptedUriSet();
  const session = await getPdsSession(locals.user.did);
  const results: Array<{ uri: string; ok: boolean; name?: string; error?: string }> = [];

  for (const uri of uris) {
    if (adopted.has(uri)) {
      results.push({ uri, ok: false, error: "Already on DevRel(ish)." });
      continue;
    }

    const parts = parseAtUri(uri);
    if (!parts || parts.collection !== EVENT_NSID) {
      results.push({ uri, ok: false, error: "Not a calendar event record." });
      continue;
    }

    const record = await getRecord(uri);
    if (!record) {
      results.push({ uri, ok: false, error: "Could not read that record." });
      continue;
    }

    const ev = toDiscovered(record.uri, record.cid, record.value, adopted);
    if (!ev.startsAt) {
      results.push({ uri, ok: false, error: "Event has no start time." });
      continue;
    }

    const start = new Date(ev.startsAt);
    if (isNaN(start.getTime())) {
      results.push({ uri, ok: false, error: "Event has an unreadable start time." });
      continue;
    }

    const meetupId = generateId();
    await db.insert(Meetups).values({
      id: meetupId,
      groupId: group.id,
      title: ev.name.slice(0, 200),
      description: ev.description ?? "",
      date: start,
      time: start.toISOString().slice(11, 16),
      venue: ev.venue ?? "See event details",
      city: ev.city,
      country: ev.country,
      capacity: 100,
      status: ev.cancelled ? "canceled" : "active",
      // Point at the EXISTING record rather than writing a new one.
      atEventUri: record.uri,
      atEventCid: record.cid,
      adopted: true,
      createdAt: new Date(),
    });

    // Link it to the group. Only possible when both the group is published and
    // the event lives in this user's repo — a meta record is written to the
    // caller's own repo, so adopting someone else's event still works, but the
    // ref points outward.
    if (session && group.atUri && group.atCid) {
      try {
        const meta = await pdsCreate(session, EVENT_META_NSID, {
          event: { uri: record.uri, cid: record.cid },
          group: { uri: group.atUri, cid: group.atCid },
          capacity: 100,
          createdAt: new Date().toISOString(),
        });
        await db
          .update(Meetups)
          .set({ atMetaUri: meta.uri, atMetaCid: meta.cid })
          .where(eq(Meetups.id, meetupId));
      } catch (err) {
        // The gathering is adopted either way; the meta record is the bonus.
        console.warn("[import/atproto] meta write failed for", uri, err);
      }
    }

    adopted.add(uri);
    results.push({ uri, ok: true, name: ev.name });
  }

  return json({ results, imported: results.filter((r) => r.ok).length });
};

async function adoptedUriSet(): Promise<Set<string>> {
  const rows = await db.select({ uri: Meetups.atEventUri }).from(Meetups);
  return new Set(rows.map((r) => r.uri).filter((u): u is string => !!u));
}

function toDiscovered(
  uri: string,
  cid: string,
  value: Record<string, unknown>,
  adopted: Set<string>
): DiscoveredEvent {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const locations = Array.isArray(value.locations) ? value.locations : [];
  const first = (locations[0] ?? {}) as Record<string, unknown>;

  return {
    uri,
    cid,
    name: str(value.name) ?? "Untitled event",
    startsAt: str(value.startsAt),
    description: str(value.description),
    venue: str(first.name),
    city: str(first.locality) ?? str(first.city),
    country: str(first.country),
    cancelled: value.status === "community.lexicon.calendar.event#cancelled",
    alreadyAdopted: adopted.has(uri),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
