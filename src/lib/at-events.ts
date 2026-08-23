// Display helpers for calendar events indexed from the network.
//
// These records come from apps we don't control, so every field is treated as
// optional and possibly the wrong shape. Nothing here throws on bad input.

import { EventStatus } from "./atproto-records";
import { parseAtUri } from "./atproto-repo";

export interface DisplayLocation {
  name?: string;
  city?: string;
  country?: string;
}

export interface DisplayUri {
  uri: string;
  name?: string;
}

/**
 * Pull a displayable place out of one location entry.
 *
 * The four community location types don't share field names:
 * `.address` has `locality` for the city, while `.geo`, `.fsq`, and `.hthree`
 * only carry `name`. Some apps also write a plain `city`, so we accept that too.
 */
export function extractLocation(loc: Record<string, unknown>): DisplayLocation {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    name: str(loc.name),
    city: str(loc.locality) ?? str(loc.city),
    country: str(loc.country),
  };
}

/** Parse the stored locations JSON into a single "Venue, City, Country" string. */
export function formatPlace(locationJson: string | null | undefined): string {
  const locations = safeParseArray(locationJson);
  if (locations.length === 0) return "";
  const { name, city, country } = extractLocation(locations[0]);
  return [name, city, country].filter(Boolean).join(", ");
}

/** Every location on the record, for the detail view. */
export function parseLocations(locationJson: string | null | undefined): DisplayLocation[] {
  return safeParseArray(locationJson).map(extractLocation).filter((l) => l.name || l.city || l.country);
}

/**
 * Links the event's own record declares — normally the source app's page for it.
 * This is the reason `uris` matters: without it a network event is a dead end.
 */
export function parseUris(urisJson: string | null | undefined): DisplayUri[] {
  return safeParseArray(urisJson)
    .map((u) => ({
      uri: typeof u.uri === "string" ? u.uri : "",
      name: typeof u.name === "string" ? u.name : undefined,
    }))
    .filter((u) => u.uri.startsWith("http"));
}

export function isCancelled(status: string | null | undefined): boolean {
  return status === EventStatus.cancelled;
}

/**
 * The DevRel(ish) page for a network event, keyed by the record's DID and rkey.
 *
 * DID colons are left raw: `:` is a legal path character, Astro doesn't decode
 * `%3A` back out of route params, and every other app in the ecosystem uses the
 * bare form (`/did:plc:.../rkey`).
 */
export function atEventPath(uri: string): string | null {
  const parts = parseAtUri(uri);
  if (!parts) return null;
  return `/events/${parts.did}/${parts.rkey}`;
}

/**
 * Best guess at which app published a record, from the hostname of its own links.
 * Only used for attribution — an unrecognised host is fine.
 */
export function sourceAppName(uris: DisplayUri[]): string | null {
  for (const { uri } of uris) {
    try {
      const host = new URL(uri).hostname.replace(/^www\./, "");
      if (host.endsWith("smokesignal.events")) return "Smoke Signal";
      if (host.endsWith("atmo.rsvp")) return "atmo.rsvp";
      if (host.endsWith("openmeet.net")) return "OpenMeet";
      if (host.endsWith("devrelish.tech")) return "DevRel(ish)";
      return host;
    } catch {
      // Not a parseable URL — try the next one.
    }
  }
  return null;
}

function safeParseArray(json: string | null | undefined): Array<Record<string, unknown>> {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v === "object") : [];
  } catch {
    return [];
  }
}

/**
 * Inbound RSVPs for one of our events, arriving from anywhere on the network.
 *
 * Someone who finds a DevRel(ish) event through Smoke Signal and RSVPs there
 * writes a `community.lexicon.calendar.rsvp` into their own repo pointing at our
 * event. The indexer stores those; without reading them back, the organizer's
 * headcount is wrong and the attendee never appears.
 *
 * Only `#going` counts toward the headcount — `#interested` isn't attendance.
 */
export const RSVP_GOING = "community.lexicon.calendar.rsvp#going";

export interface NetworkRsvp {
  did: string;
  status: string;
  createdAt: string;
}

export function isGoing(status: string | null | undefined): boolean {
  // Tolerate apps that write the bare token rather than the full NSID form.
  return status === RSVP_GOING || status === "going";
}
