import type { APIRoute } from "astro";
import { db, ContactMessages } from "astro:db";
import { eq } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return redirect("/auth/login");

  const { id } = params;
  if (!id) return redirect("/dashboard/messages");

  const [msg] = await db.select().from(ContactMessages).where(eq(ContactMessages.id, id));
  if (!msg) return redirect("/dashboard/messages");

  const isAdmin = locals.user.role === "admin";

  if (!isAdmin) {
    if (!locals.user.groupId || locals.user.groupId !== msg.groupId) {
      return redirect("/dashboard/messages");
    }
  }

  await db.delete(ContactMessages).where(eq(ContactMessages.id, id));

  return redirect("/dashboard/messages?deleted=1");
};

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}
