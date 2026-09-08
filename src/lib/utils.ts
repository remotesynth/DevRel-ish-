/** Return the best public URL for a group — custom short URL if set, canonical otherwise */
export function groupUrl(group: { slug: string; customSlug?: string | null }): string {
  return group.customSlug ? `/${group.customSlug}` : `/groups/${group.slug}`;
}

/** Convert a group name to a URL-safe slug */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Generate a random ID */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Format a date for display. Always uses UTC so the calendar date matches what was stored. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format time from "HH:MM" 24-hour to "h:MM AM/PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Count remaining spots. A null capacity means unlimited, so null comes back. */
export function spotsLeft(capacity: number | null, rsvpCount: number): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - rsvpCount);
}

/** Whether a gathering has hit its cap. An uncapped gathering is never full. */
export function isFull(capacity: number | null, rsvpCount: number): boolean {
  return capacity != null && rsvpCount >= capacity;
}

export type GatheringMode = "inperson" | "virtual" | "hybrid";

export function isOnline(mode: string | null | undefined): boolean {
  return mode === "virtual" || mode === "hybrid";
}

/** Determine an event's end wall-clock date/time, including overnight events. */
export function eventEnd(date: Date, startTime: string, endTime?: string | null): { date: Date; time: string } {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  if (endTime) {
    const endDate = new Date(date);
    if (endTime <= startTime) endDate.setUTCDate(endDate.getUTCDate() + 1);
    return { date: endDate, time: endTime };
  }

  const endDate = new Date(date);
  const end = startHour * 60 + startMinute + 120;
  if (end >= 24 * 60) endDate.setUTCDate(endDate.getUTCDate() + 1);
  return {
    date: endDate,
    time: `${String(Math.floor((end % (24 * 60)) / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
  };
}

/** Build an OpenStreetMap search URL for a venue + optional address */
export function osmUrl(venue: string, address?: string | null): string {
  const query = [venue, address].filter(Boolean).join(", ");
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

/**
 * Build a Google Calendar "add event" URL.
 * Uses floating (no-timezone) datetime so it matches the stored wall-clock time.
 */
export function googleCalendarUrl(opts: {
  title: string;
  date: Date;
  time: string;
 endTime?: string | null;
  timeZone?: string | null;
  venue: string | null | undefined;
  address: string | null | undefined;
  description: string;
}): string {
  const { title, date, time, endTime, venue, address, description, timeZone } = opts;

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  function gcalDT(d: Date, t: string): string {
    const [hh, mm] = t.split(":").map(Number);
    const y = d.getUTCFullYear();
    const mo = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    return `${y}${mo}${day}T${pad(hh)}${pad(mm)}00`;
  }

  const start = gcalDT(date, time);
  const eventEndValue = eventEnd(date, time, endTime);
  const end = gcalDT(eventEndValue.date, eventEndValue.time);

  // No venue means an online gathering. The joining link is deliberately not
  // put here: a calendar entry travels further than the attendee it was for.
  const location = [venue, address].filter(Boolean).join(", ") || "Online";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: description,
    location,
    ...(timeZone ? { ctz: timeZone } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}
