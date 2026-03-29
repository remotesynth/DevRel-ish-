import type { APIRoute } from "astro";
import { db, Groups, User } from "astro:db";
import { eq } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  // Admin only
  if (!locals.user || locals.user.role !== "admin") {
    return json({ error: "Unauthorized." }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { id, status } = body as Record<string, string>;

  if (!id || !["approved", "rejected", "closed"].includes(status)) {
    return json({ error: "Invalid parameters." }, 400);
  }

  const [group] = await db.select().from(Groups).where(eq(Groups.id, id));
  if (!group) {
    return json({ error: "Group not found." }, 404);
  }

  if (status === "rejected" || status === "closed") {
    await db.update(Groups).set({ status }).where(eq(Groups.id, id));
    return json({ ok: true });
  }

  // On approval: find or create a manager account
  let managerId: string | null = null;

  const [existingUser] = await db
    .select()
    .from(User)
    .where(eq(User.email, group.contactEmail));

  if (existingUser) {
    managerId = existingUser.id;
    // Link group to existing user
    await db.update(User).set({ groupId: id }).where(eq(User.id, existingUser.id));
  }
  // If user doesn't exist, they'll register and the admin can link them later
  // The group shows as approved but managerId stays null until they sign up

  await db
    .update(Groups)
    .set({ status: "approved", managerId })
    .where(eq(Groups.id, id));

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
