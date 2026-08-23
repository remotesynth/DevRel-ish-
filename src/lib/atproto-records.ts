// Builders for the community lexicon records DevRel(ish) publishes.
//
// These live in one place because the same records are written from several
// routes, and because getting the field names exactly right is what makes the
// records usable by other Atmosphere apps rather than merely well-formed.
//
// Schemas: https://tangled.org/lexicon.community/lexicons

export const EVENT_NSID = "community.lexicon.calendar.event";
export const RSVP_NSID = "community.lexicon.calendar.rsvp";
export const ADDRESS_NSID = "community.lexicon.location.address";

export const EventMode = {
  inperson: "community.lexicon.calendar.event#inperson",
  virtual: "community.lexicon.calendar.event#virtual",
  hybrid: "community.lexicon.calendar.event#hybrid",
} as const;

export const EventStatus = {
  planned: "community.lexicon.calendar.event#planned",
  scheduled: "community.lexicon.calendar.event#scheduled",
  rescheduled: "community.lexicon.calendar.event#rescheduled",
  cancelled: "community.lexicon.calendar.event#cancelled",
  postponed: "community.lexicon.calendar.event#postponed",
} as const;

export type EventStatusValue = (typeof EventStatus)[keyof typeof EventStatus];

export const RsvpStatus = {
  going: "community.lexicon.calendar.rsvp#going",
  interested: "community.lexicon.calendar.rsvp#interested",
  notgoing: "community.lexicon.calendar.rsvp#notgoing",
} as const;

export type RsvpStatusValue = (typeof RsvpStatus)[keyof typeof RsvpStatus];

export interface AddressInput {
  name?: string | null;
  street?: string | null;
  locality?: string | null; // city
  region?: string | null;   // state / province
  country?: string | null;
  postalCode?: string | null;
}

export interface AddressRecord {
  $type: typeof ADDRESS_NSID;
  country: string;
  name?: string;
  street?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
}

/**
 * Build a `community.lexicon.location.address`.
 *
 * `country` is the only REQUIRED field in the lexicon, so an address without
 * one is not a valid address — we return null rather than emit a record other
 * apps will reject. Note the field names: the lexicon says `locality` (not
 * `city`) and `region` (not `state`).
 */
export function buildAddress(input: AddressInput): AddressRecord | null {
  const country = input.country?.trim();
  if (!country) return null;

  const address: AddressRecord = { $type: ADDRESS_NSID, country };
  if (input.name?.trim()) address.name = input.name.trim();
  if (input.street?.trim()) address.street = input.street.trim();
  if (input.locality?.trim()) address.locality = input.locality.trim();
  if (input.region?.trim()) address.region = input.region.trim();
  if (input.postalCode?.trim()) address.postalCode = input.postalCode.trim();
  return address;
}

/**
 * Combine a date and an "HH:MM" time into an ISO datetime.
 * Treated as UTC; timezone-aware scheduling is a future improvement.
 */
export function buildStartsAt(date: Date, timeStr: string): string {
  const dateStr = date.toISOString().split("T")[0]; // "YYYY-MM-DD"
  return `${dateStr}T${timeStr}:00.000Z`;
}

/**
 * An end time at or before the start time means the event runs past midnight,
 * so it belongs to the following day.
 */
export function buildEndsAt(
  date: Date,
  startTime: string,
  endTime: string | null | undefined
): string | null {
  if (!endTime) return null;
  const day = new Date(date);
  if (endTime <= startTime) day.setUTCDate(day.getUTCDate() + 1);
  return buildStartsAt(day, endTime);
}

export interface EventUri {
  uri: string;
  name?: string;
}

export interface CalendarEventInput {
  name: string;
  description: string;
  startsAt: string;             // ISO datetime
  endsAt?: string | null;       // ISO datetime
  createdAt: string;            // ISO datetime
  location?: AddressRecord | null;
  /** Canonical DevRel(ish) page for this event — how other apps link back. */
  canonicalUrl?: string | null;
  mode?: string;
  status?: EventStatusValue;
  rsvpExpected?: boolean;
}

/**
 * Build a `community.lexicon.calendar.event`.
 *
 * The optional fields matter more than they look. Without `uris`, an app that
 * surfaces this event has no URL to send people to. Without `status`, there is
 * no way to tell the network the event was cancelled.
 */
export function buildCalendarEvent(input: CalendarEventInput): Record<string, unknown> {
  const record: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    startsAt: input.startsAt,
    createdAt: input.createdAt,
    mode: input.mode ?? EventMode.inperson,
    status: input.status ?? EventStatus.scheduled,
    rsvpExpected: input.rsvpExpected ?? true,
  };

  if (input.endsAt) record.endsAt = input.endsAt;
  if (input.location) record.locations = [input.location];
  if (input.canonicalUrl) {
    record.uris = [{ uri: input.canonicalUrl, name: "RSVP on DevRel(ish)" }] satisfies EventUri[];
  }

  return record;
}

/**
 * Absolute URL of a gathering's public page — used for the event record's `uris`.
 *
 * Deliberately built from PUBLIC_URL rather than the incoming request origin:
 * this URL is published to the network, so it has to be the canonical site, not
 * whatever preview deploy happened to serve the write.
 */
export function gatheringUrl(gatheringId: string): string {
  const siteUrl = import.meta.env.PUBLIC_URL ?? "http://localhost:4321";
  return new URL(`/gatherings/${gatheringId}/rsvp`, siteUrl).toString();
}
