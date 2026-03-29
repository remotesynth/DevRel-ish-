import type { APIRoute } from "astro";
import { db, Meetups, Groups } from "astro:db";
import { eq, and } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return redirect("/auth/login");

  const { id } = params;
  if (!id) return redirect("/dashboard/meetups");

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

  if (!meetup) return redirect("/dashboard/meetups");

  const newStatus = meetup.status === "canceled" ? "active" : "canceled";
  await db.update(Meetups).set({ status: newStatus }).where(eq(Meetups.id, id));

  return redirect("/dashboard/meetups");
};

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}
