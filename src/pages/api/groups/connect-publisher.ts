import type { APIRoute } from "astro";
import { db, Groups, eq } from "astro:db";
import {
  OAUTH_INTENT_COOKIE,
  OAUTH_INTENT_COOKIE_OPTIONS,
  publisherIntent,
} from "../../../lib/oauth-intent";

export const prerender = false;

export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  if (!locals.user) return redirect("/auth/login");

  const [group] = locals.user.groupId
    ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
    : [];

  if (!group) return redirect("/dashboard?error=no-group");
  if (group.managerId !== locals.user.did && locals.user.role !== "admin") {
    return new Response("Only the group owner can connect its publisher account.", { status: 403 });
  }

  cookies.set(OAUTH_INTENT_COOKIE, publisherIntent(group.id), OAUTH_INTENT_COOKIE_OPTIONS);
  return redirect("/auth/login?intent=publisher");
};
