import assert from "node:assert/strict";
import test from "node:test";
import { buildEndsAt, buildStartsAt } from "../src/lib/atproto-records";
import { isPublicIpAddress } from "../src/lib/safe-external-url";
import { normalizeTimeZone } from "../src/lib/timezone";

test("ATProto event timestamps preserve the organizer's IANA wall-clock time", () => {
  const date = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(buildStartsAt(date, "18:30", "America/New_York"), "2026-09-01T22:30:00.000Z");
  assert.equal(buildEndsAt(date, "23:30", "01:00", "America/New_York"), "2026-09-02T05:00:00.000Z");
  assert.equal(normalizeTimeZone("not/a-timezone"), null);
});

test("external PDS resolution rejects private and loopback addresses", () => {
  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.169.254"), false);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
});
