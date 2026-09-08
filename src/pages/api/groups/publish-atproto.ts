import type { APIRoute } from "astro";
import { db, Groups, eq } from "astro:db";
import { enqueueGroupPublication, reconcilePublicationOutbox } from "../../../lib/publication-outbox";

export const prerender = false;

export const POST: APIRoute = async ({ locals, redirect }) => {
  if (!locals.user) return redirect("/auth/login");

  const [group] = locals.user.groupId
    ? await db.select().from(Groups).where(eq(Groups.id, locals.user.groupId))
    : await db.select().from(Groups).where(eq(Groups.managerId, locals.user.did));

  if (!group) return redirect("/dashboard?error=no-group");
  if (!group.publisherDid) return redirect("/dashboard?error=publisher-not-connected");
  const job = await enqueueGroupPublication(group.id);
  const result = await reconcilePublicationOutbox({ ids: [job], limit: 1 });
  return redirect(result.completed ? "/dashboard?published=atproto" : "/dashboard?published=queued");
};
