import type { APIRoute } from "astro";
import { db, Meetups, Groups, eq } from "astro:db";
import { createHash } from "node:crypto";
import { generateId } from "../../../lib/utils";
import { getPdsSession, pdsCreate } from "../../../lib/atproto-pds";
import { RSVP_NSID, RsvpStatus } from "../../../lib/atproto-records";
import { networkGoingCount } from "../../../lib/rsvp-capacity";
import { reserveLocalRsvp } from "../../../lib/rsvp-reservation";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { gatheringId } = params;

  if (!gatheringId) return json({ error: "Missing gathering ID." }, 400);

  const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, gatheringId));
  if (!meetup) return json({ error: "Gathering not found." }, 404);

  if (meetup.status === "canceled") {
    return json({ error: "This gathering has been cancelled." }, 400);
  }

  const [group] = await db.select().from(Groups).where(eq(Groups.id, meetup.groupId));
  if (!group || group.status !== "active") {
    return json({ error: "Gathering not available." }, 404);
  }

  if (meetup.date < new Date()) {
    return json({ error: "This gathering has already passed." }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, email, jobTitle, company } = body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !jobTitle?.trim() || !company?.trim()) {
    return json({ error: "All fields are required." }, 400);
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const networkGoing = await networkGoingCount(meetup.atEventUri);
  const reservation = await reserveLocalRsvp({
    id: generateId(),
    meetupId: gatheringId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    jobTitle: jobTitle.trim(),
    company: company.trim(),
    availableLocalSeats: meetup.capacity == null ? null : meetup.capacity - networkGoing,
  });
  if (reservation === "duplicate") return json({ error: "Already registered.", code: "duplicate" }, 409);
  if (reservation === "full") return json({ error: "This gathering is full.", code: "full" }, 409);

  // If the user is logged in and the event has an AT URI, also write an ATProto RSVP
  // to their PDS so it appears in the ATProto network (Smoke Signal interop, etc.)
  if (locals.user && meetup.atEventUri && meetup.atEventCid) {
    const session = await getPdsSession(locals.user.did);
    if (session) {
      const rsvpRkey = createHash("sha256")
        .update(meetup.atEventUri!)
        .digest("hex")
        .slice(0, 13);
      pdsCreate(session, RSVP_NSID, {
        subject: { uri: meetup.atEventUri, cid: meetup.atEventCid },
        status: RsvpStatus.going,
        createdAt: new Date().toISOString(),
      }, rsvpRkey).catch(err => console.warn("[rsvp] ATProto RSVP failed (non-fatal):", err));
    }
  }

  return json({ ok: true }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
