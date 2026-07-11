import type { APIRoute } from "astro";
import { db, Groups, eq } from "astro:db";
import { getPdsSession, pdsCreate } from "../../../../lib/atproto-pds";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, request }) => {
  if (!locals.user) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/auth/login?redirect=${encodeURIComponent(request.url)}` },
    });
  }

  const { id } = params;
  if (!id) return json({ error: "Missing group ID." }, 400);

  const [group] = await db.select().from(Groups).where(eq(Groups.id, id));
  if (!group || group.status !== "active") {
    return json({ error: "Group not found." }, 404);
  }

  if (!group.atUri || !group.atCid) {
    return json({ error: "This group is not yet published to the ATProto network." }, 400);
  }

  const session = await getPdsSession(locals.user.did);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/auth/login?redirect=${encodeURIComponent(request.url)}` },
    });
  }

  try {
    await pdsCreate(session, "com.devrelish.membership", {
      group: { uri: group.atUri, cid: group.atCid },
      role: "member",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[groups/join] PDS write failed:", err);
    return json({ error: "Could not post membership to ATProto. Please try again." }, 500);
  }

  // Redirect back to the group page
  const groupPath = group.customSlug ? `/${group.customSlug}` : `/groups/${group.slug}`;
  return new Response(null, {
    status: 302,
    headers: { Location: `${groupPath}?joined=atproto` },
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
