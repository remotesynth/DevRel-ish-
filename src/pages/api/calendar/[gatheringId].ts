import type { APIRoute } from "astro";
import { db, Meetups, Groups } from "astro:db";
import { eq } from "astro:db";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const { gatheringId } = params;
  if (!gatheringId) return new Response("Not found", { status: 404 });

  const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, gatheringId));
  if (!meetup) return new Response("Not found", { status: 404 });

  const [group] = await db.select().from(Groups).where(eq(Groups.id, meetup.groupId));
  if (!group || group.status !== "approved") return new Response("Not found", { status: 404 });

  const ics = buildICS(meetup, group, url.origin);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar;charset=utf-8",
      "Content-Disposition": `attachment; filename="devrelish-${meetup.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Build a "floating" ICS datetime (no timezone suffix).
 * This displays at the correct wall-clock time regardless of the
 * attendee's timezone — appropriate since we store time without tz.
 */
function floatingDT(date: Date, time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  // Use UTC date components because AstroDB stores dates at midnight UTC.
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `${y}${mo}${d}T${pad(hh)}${pad(mm)}00`;
}

function escapeICS(s: string): string {
  // Per RFC 5545: escape backslash, semicolons, commas, then fold long lines
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function buildICS(
  meetup: { id: string; title: string; description: string; date: Date; time: string; venue: string; address: string | null },
  group: { name: string; slug: string },
  origin: string
): string {
  const [hh, mm] = meetup.time.split(":").map(Number);
  const dtstart = floatingDT(meetup.date, meetup.time);
  // Default duration: 2 hours
  const endHH = (hh + 2) % 24;
  const dtend = floatingDT(meetup.date, `${pad(endHH)}:${pad(mm)}`);

  const location = [meetup.venue, meetup.address].filter(Boolean).join(", ");
  const eventUrl = `${origin}/gatherings/${meetup.id}/rsvp`;
  const description = `${meetup.description}\n\nHosted by ${group.name}\nMore info: ${eventUrl}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DevRel(ish)//devrelish.tech//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICS(meetup.title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    `URL:${eventUrl}`,
    `UID:${meetup.id}@devrelish.tech`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n");
}
