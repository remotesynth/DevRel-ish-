import { db, AppUser, Groups, eq } from "astro:db";
import { getPdsSession, pdsPut } from "./atproto-pds";
import { buildAddress, GROUP_NSID } from "./atproto-records";

type GroupRow = typeof Groups.$inferSelect;

export function groupRecordFor(group: GroupRow, coOrganizers: string[] = []) {
  const address = buildAddress({
    locality: group.city,
    region: group.region,
    country: group.country,
  });

  return {
    name: group.name,
    description: group.description,
    ...(group.category ? { category: group.category } : {}),
    ...(group.website ? { website: group.website } : {}),
    ...(group.handle ? { handle: group.handle } : {}),
    ...(group.handleDid ? { did: group.handleDid } : {}),
    ...(group.linkedinUrl ? { linkedinUrl: group.linkedinUrl } : {}),
    ...(coOrganizers.length ? { coOrganizers } : {}),
    ...(address ? { location: address } : {}),
    createdAt: group.createdAt.toISOString(),
  };
}

/**
 * Write the group under a stable rkey. `putRecord` is create-or-replace, which
 * makes a retry safe even if the original PDS response was lost in transit.
 */
export async function reconcileGroupPublication(group: GroupRow): Promise<void> {
  if (!group.publisherDid) throw new Error("The group publisher account is not connected");
  const session = await getPdsSession(group.publisherDid);
  if (!session) throw new Error("The group publisher account needs to reauthorize");

  const people = await db.select({ did: AppUser.did }).from(AppUser).where(eq(AppUser.groupId, group.id));
  const coOrganizers = people.map(({ did }) => did).filter((did) => did !== group.managerId);
  const uri = `at://${group.publisherDid}/${GROUP_NSID}/group-${group.id}`;
  const result = await pdsPut(session, uri, groupRecordFor(group, coOrganizers));
  await db.update(Groups).set({ atUri: result.uri, atCid: result.cid }).where(eq(Groups.id, group.id));
}
