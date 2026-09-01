import type { APIRoute } from "astro";
import { db, Groups, eq } from "astro:db";
import { getPdsSession, pdsCreate } from "../../../lib/atproto-pds";
import { buildAddress, GROUP_NSID } from "../../../lib/atproto-records";

export const prerender = false;

export const POST: APIRoute = async ({ locals, redirect }) => {
  if (!locals.user) return redirect("/auth/login");

  const [group] = await db
    .select()
    .from(Groups)
    .where(eq(Groups.managerId, locals.user.did));

  if (!group) return redirect("/dashboard?error=no-group");
  if (group.atUri) return redirect("/dashboard?published=already");

  const session = await getPdsSession(locals.user.did);
  if (!session) return redirect("/auth/login");

  try {
    const address = buildAddress({
      locality: group.city,
      region: group.region,
      country: group.country,
    });
    const locationEntry = address ? { location: address } : {};

    const result = await pdsCreate(session, GROUP_NSID, {
      name: group.name,
      description: group.description,
      ...(group.category ? { category: group.category } : {}),
      ...(group.website ? { website: group.website } : {}),
      ...(group.handle ? { handle: group.handle } : {}),
      ...(group.handleDid ? { did: group.handleDid } : {}),
      ...(group.linkedinUrl ? { linkedinUrl: group.linkedinUrl } : {}),
      ...locationEntry,
      createdAt: group.createdAt.toISOString(),
    });

    await db
      .update(Groups)
      .set({ atUri: result.uri, atCid: result.cid })
      .where(eq(Groups.id, group.id));

    return redirect("/dashboard?published=atproto");
  } catch (err) {
    console.error("[groups/publish-atproto] PDS write failed:", err);
    return redirect("/dashboard?error=publish-failed");
  }
};
