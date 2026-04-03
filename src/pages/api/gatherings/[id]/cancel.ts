import type { APIRoute } from "astro";
import { db, Meetups, Groups, RSVPs } from "astro:db";
import { eq, and } from "astro:db";
import { sendCancellationNotice } from "../../../../lib/email";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return redirect("/auth/login");

  const { id } = params;
  if (!id) return redirect("/dashboard/gatherings");

  // Verify ownership
  const [group] = locals.user.groupId
    ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
    : [];

  const isAdmin = locals.user.role === "admin";

  const [meetup] = isAdmin
    ? await db.select().from(Meetups).where(eq(Meetups.id, id))
    : group
      ? await db.select().from(Meetups).where(and(eq(Meetups.id, id), eq(Meetups.groupId, group.id)))
      : [];

  if (!meetup) return redirect("/dashboard/gatherings");

  const newStatus = meetup.status === "canceled" ? "active" : "canceled";
  await db.update(Meetups).set({ status: newStatus }).where(eq(Meetups.id, id));

  // Notify RSVPs only when cancelling (not when restoring)
  if (newStatus === "canceled") {
    const rsvps = await db.select({ email: RSVPs.email, name: RSVPs.name }).from(RSVPs).where(eq(RSVPs.meetupId, id));
    const groupRecord = group ?? (await db.select().from(Groups).where(eq(Groups.id, meetup.groupId)).then(r => r[0]));
    if (rsvps.length > 0 && groupRecord) {
      sendCancellationNotice({
        rsvps,
        groupName: groupRecord.name,
        gathering: { title: meetup.title, date: meetup.date, venue: meetup.venue },
      }).catch(e => console.error("[cancel notify] email error:", e));
    }
  }

  return redirect("/dashboard/gatherings");
};

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}
