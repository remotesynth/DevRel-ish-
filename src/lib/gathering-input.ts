// Pure input rules for a gathering's location and capacity.
//
// Deliberately free of `astro:db` imports: these are the rules four call sites
// share (both dashboard forms and both API routes), and keeping them importable
// on their own is what lets them be exercised without a database.

export const GATHERING_MODES = ["inperson", "virtual", "hybrid"] as const;
export type Mode = (typeof GATHERING_MODES)[number];

export function normalizeMode(raw: unknown): Mode {
  const v = String(raw ?? "").trim();
  return (GATHERING_MODES as readonly string[]).includes(v) ? (v as Mode) : "inperson";
}

/** An http(s) meeting link, or null if it isn't one. */
export function normalizeJoinUrl(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  try {
    const url = new URL(v.startsWith("http") ? v : `https://${v}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve where a gathering happens, or explain why it doesn't add up.
 *
 * Returns the columns to store, so a virtual gathering can't keep a stale venue
 * from before the organizer switched its mode.
 */
export function resolveLocation(input: {
  mode: unknown;
  venue: string;
  joinUrl: string;
  address?: string;
}): { error: string } | { mode: Mode; venue: string | null; joinUrl: string | null; address: string | null } {
  const mode = normalizeMode(input.mode);
  const venue = input.venue.trim();
  const address = (input.address ?? "").trim();

  if (mode !== "virtual" && !venue) {
    return { error: "A venue name is required for an in-person gathering." };
  }

  let joinUrl: string | null = null;
  if (mode !== "inperson") {
    joinUrl = normalizeJoinUrl(input.joinUrl);
    if (!joinUrl) {
      return { error: "An online gathering needs a joining link (a full https:// URL)." };
    }
  }

  return {
    mode,
    venue: mode === "virtual" ? null : venue,
    joinUrl,
    address: mode === "virtual" ? null : address || null,
  };
}

/** Blank capacity means unlimited. Returns an error message for a bad number. */
export function resolveCapacity(raw: unknown): { error: string } | { capacity: number | null } {
  const v = String(raw ?? "").trim();
  if (!v) return { capacity: null };
  const cap = Number(v);
  if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
    return { error: "Capacity must be a whole number between 1 and 500, or blank for unlimited." };
  }
  return { capacity: cap };
}
