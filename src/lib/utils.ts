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

/** Format a date for display */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Format time from "HH:MM" 24-hour to "h:MM AM/PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Count remaining spots */
export function spotsLeft(capacity: number, rsvpCount: number): number {
  return Math.max(0, capacity - rsvpCount);
}

/**
 * Build a Google Calendar "add event" URL.
 * Uses floating (no-timezone) datetime so it matches the stored wall-clock time.
 */
export function googleCalendarUrl(opts: {
  title: string;
  date: Date;
  time: string;
  venue: string;
  address: string | null | undefined;
  description: string;
}): string {
  const { title, date, time, venue, address, description } = opts;

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

  const [hh, mm] = time.split(":").map(Number);
  const endHH = (hh + 2) % 24;
  const start = gcalDT(date, time);
  const end = gcalDT(date, `${pad(endHH)}:${pad(mm)}`);

  const location = [venue, address].filter(Boolean).join(", ");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: description,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}
