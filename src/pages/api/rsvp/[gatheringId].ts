import type { APIRoute } from "astro";
import { db, RSVPs, Meetups, Groups } from "astro:db";
import { eq, and, count } from "astro:db";
import { generateId } from "../../../lib/utils";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const { gatheringId } = params;

  if (!gatheringId) return json({ error: "Missing gathering ID." }, 400);

  // Verify meetup exists and group is approved
  const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, gatheringId));
  if (!meetup) return json({ error: "Gathering not found." }, 404);

  if (meetup.status === "canceled") {
    return json({ error: "This gathering has been cancelled." }, 400);
  }

  const [group] = await db.select().from(Groups).where(eq(Groups.id, meetup.groupId));
  if (!group || group.status !== "approved") {
    return json({ error: "Gathering not available." }, 404);
  }

  // Meetup must be in the future
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

  // Check for duplicate RSVP
  const [duplicate] = await db
    .select()
    .from(RSVPs)
    .where(and(eq(RSVPs.meetupId, gatheringId), eq(RSVPs.email, email.toLowerCase())));

  if (duplicate) {
    return json({ error: "Already registered.", code: "duplicate" }, 409);
  }

  // Check capacity
  const [countResult] = await db
    .select({ val: count() })
    .from(RSVPs)
    .where(eq(RSVPs.meetupId, gatheringId));

  const rsvpCount = countResult?.val ?? 0;
  if (rsvpCount >= meetup.capacity) {
    return json({ error: "This gathering is full.", code: "full" }, 409);
  }

  await db.insert(RSVPs).values({
    id: generateId(),
    meetupId: gatheringId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    jobTitle: jobTitle.trim(),
    company: company.trim(),
    createdAt: new Date(),
  });

  return json({ ok: true }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
