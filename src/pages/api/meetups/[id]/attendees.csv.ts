import type { APIRoute } from "astro";
import { db, Meetups, Groups, RSVPs } from "astro:db";
import { eq, and, asc } from "astro:db";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const { id } = params;
  if (!id) return new Response("Not found", { status: 404 });

  // Verify the requesting user owns this meetup's group
  const [group] = locals.user.groupId
    ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
    : [];

  // Admins can export any meetup
  const isAdmin = locals.user.role === "admin";

  const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, id));
  if (!meetup) return new Response("Not found", { status: 404 });

  if (!isAdmin && (!group || group.id !== meetup.groupId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const attendees = await db
    .select()
    .from(RSVPs)
    .where(eq(RSVPs.meetupId, id))
    .orderBy(asc(RSVPs.createdAt));

  const rows = [
    ["Name", "Email", "Job Title", "Company", "RSVP Date"],
    ...attendees.map((a) => [
      a.name,
      a.email,
      a.jobTitle,
      a.company,
      a.createdAt.toISOString().split("T")[0],
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = `rsvps-${id}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};

/** Wrap a value in quotes and escape any quotes within it */
function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
