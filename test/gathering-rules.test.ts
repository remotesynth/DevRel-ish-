import assert from "node:assert/strict";
import test from "node:test";
import { resolveCapacity, resolveLocation } from "../src/lib/gathering-input";
import { eventEnd, googleCalendarUrl } from "../src/lib/utils";

test("virtual gatherings discard stale venue data and require a joining link", () => {
  assert.deepEqual(resolveLocation({ mode: "virtual", venue: "Old venue", address: "Old address", joinUrl: "meet.example.com/room" }), {
    mode: "virtual",
    venue: null,
    address: null,
    joinUrl: "https://meet.example.com/room",
  });
  assert.deepEqual(resolveLocation({ mode: "virtual", venue: "", joinUrl: "" }), {
    error: "An online gathering needs a joining link (a full https:// URL).",
  });
});

test("capacity accepts only a bounded positive integer", () => {
  assert.deepEqual(resolveCapacity(""), { capacity: null });
  assert.deepEqual(resolveCapacity("42"), { capacity: 42 });
  assert.ok("error" in resolveCapacity("0"));
  assert.ok("error" in resolveCapacity("3.5"));
});

test("event end time preserves explicit overnight end times", () => {
  const date = new Date("2026-09-01T00:00:00.000Z");
  const end = eventEnd(date, "23:30", "01:00");
  assert.equal(end.date.toISOString().slice(0, 10), "2026-09-02");
  assert.equal(end.time, "01:00");
});

test("calendar links use the organizer's explicit end time", () => {
  const url = new URL(googleCalendarUrl({
    title: "Overnight online gathering",
    date: new Date("2026-09-01T00:00:00.000Z"),
    time: "23:30",
    endTime: "01:00",
    venue: null,
    address: null,
    description: "Test event",
  }));
  assert.equal(url.searchParams.get("dates"), "20260901T233000/20260902T010000");
  assert.equal(url.searchParams.get("location"), "Online");
});
