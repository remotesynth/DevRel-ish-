/** Validate and normalize an IANA timezone identifier used for a group's events. */
export function normalizeTimeZone(value: string | null | undefined): string | null {
  const zone = value?.trim() || "UTC";
  if (zone === "UTC") return zone;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
