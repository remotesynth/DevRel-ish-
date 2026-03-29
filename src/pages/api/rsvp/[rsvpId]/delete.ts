import type { APIRoute } from "astro";
import { db, RSVPs, Meetups, Groups } from "astro:db";
import { eq } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, request }) => {
  if (!locals.user) return redirect("/auth/login");

  const { rsvpId } = params;
  if (!rsvpId) return redirect("/dashboard");

  const [rsvp] = await db.select().from(RSVPs).where(eq(RSVPs.id, rsvpId));
  if (!rsvp) return redirect("/dashboard/meetups");

  // Verify the user owns the group that owns this meetup
  const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, rsvp.meetupId));
  if (!meetup) return redirect("/dashboard/meetups");

  const isAdmin = locals.user.role === "admin";

  if (!isAdmin) {
    const [group] = locals.user.groupId
      ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
      : [];

    if (!group || group.id !== meetup.groupId) {
      return redirect("/dashboard/meetups");
    }
  }

  await db.delete(RSVPs).where(eq(RSVPs.id, rsvpId));

  return redirect(`/dashboard/meetups/${meetup.id}/attendees?removed=1`);
};

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}
