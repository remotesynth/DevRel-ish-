import type { APIRoute } from "astro";
import { db, Groups, eq } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
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

  // Admins can only set a group to closed (remove it from listings).
  // Groups are active by default when created — no approval gate.
  if (!id || !["active", "closed"].includes(status)) {
    return json({ error: "Invalid parameters. status must be 'active' or 'closed'." }, 400);
  }

  const [group] = await db.select().from(Groups).where(eq(Groups.id, id));
  if (!group) {
    return json({ error: "Group not found." }, 404);
  }

  await db.update(Groups).set({ status }).where(eq(Groups.id, id));
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
