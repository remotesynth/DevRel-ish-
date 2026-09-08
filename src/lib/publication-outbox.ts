import { db, Groups, Meetups, PublicationOutbox, eq } from "astro:db";
import { pdsDelete, getPdsSession, pdsPut } from "./atproto-pds";
import { EVENT_META_NSID, reconcileGatheringPublication } from "./gatherings";
import { reconcileGroupPublication } from "./group-publication";

const MAX_ATTEMPTS_PER_RUN = 12;

type JobKind = "group" | "gathering" | "claim-adopted" | "delete-gathering";
type DeletePayload = { publisherDid: string; eventUri: string; metaUri?: string | null };

function jobId(kind: JobKind, subjectId: string): string {
  return `${kind}:${subjectId}`;
}

function retryAt(attempts: number): Date {
  // The scheduled worker runs every 15 minutes. Back off from there to 24 h,
  // avoiding a permanently disconnected PDS consuming every scheduled run.
  const minutes = Math.min(15 * 2 ** Math.max(0, attempts - 1), 24 * 60);
  return new Date(Date.now() + minutes * 60_000);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown publication failure";
  return message.slice(0, 500);
}

async function enqueue(kind: JobKind, groupId: string, subjectId: string, payload?: string): Promise<string> {
  const id = jobId(kind, subjectId);
  const now = new Date();
  await db.insert(PublicationOutbox).values({
    id,
    kind,
    groupId,
    meetupId: kind === "group" ? null : subjectId,
    payload: payload ?? null,
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: PublicationOutbox.id,
    set: { payload: payload ?? null, attempts: 0, nextAttemptAt: now, lastError: null, updatedAt: now },
  });
  return id;
}

export function enqueueGroupPublication(groupId: string): Promise<string> {
  return enqueue("group", groupId, groupId);
}

export function enqueueGatheringPublication(groupId: string, meetupId: string): Promise<string> {
  return enqueue("gathering", groupId, meetupId);
}

export function enqueueAdoptedGatheringClaim(groupId: string, meetupId: string): Promise<string> {
  return enqueue("claim-adopted", groupId, meetupId);
}

export async function enqueueGatheringDeletion(
  groupId: string,
  meetup: { id: string; atEventUri: string | null; atMetaUri: string | null },
  publisherDid: string | null
): Promise<string | null> {
  await db.delete(PublicationOutbox).where(eq(PublicationOutbox.id, jobId("gathering", meetup.id)));
  await db.delete(PublicationOutbox).where(eq(PublicationOutbox.id, jobId("claim-adopted", meetup.id)));
  if (!publisherDid || !meetup.atEventUri || meetup.atEventUri.split("/")[2] !== publisherDid) return null;
  return enqueue("delete-gathering", groupId, meetup.id, JSON.stringify({
    publisherDid,
    eventUri: meetup.atEventUri,
    // A pre-migration meta record may be owned by an organizer's personal
    // account. Never ask the group account to delete somebody else's record.
    metaUri: meetup.atMetaUri?.split("/")[2] === publisherDid ? meetup.atMetaUri : null,
  } satisfies DeletePayload));
}

async function reconcileJob(job: typeof PublicationOutbox.$inferSelect): Promise<void> {
  if (job.kind === "group") {
    const [group] = await db.select().from(Groups).where(eq(Groups.id, job.groupId));
    if (!group) return;
    await reconcileGroupPublication(group);
    const gatherings = await db.select().from(Meetups).where(eq(Meetups.groupId, group.id));
    await Promise.all(gatherings.map((gathering) => gathering.adopted
      ? enqueueAdoptedGatheringClaim(group.id, gathering.id)
      : enqueueGatheringPublication(group.id, gathering.id)
    ));
    return;
  }

  if (job.kind === "gathering") {
    if (!job.meetupId) return;
    const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, job.meetupId));
    const [group] = await db.select().from(Groups).where(eq(Groups.id, job.groupId));
    if (!meetup || !group) return;
    await reconcileGatheringPublication(meetup, group);
    return;
  }

  if (job.kind === "claim-adopted") {
    if (!job.meetupId) return;
    const [meetup] = await db.select().from(Meetups).where(eq(Meetups.id, job.meetupId));
    const [group] = await db.select().from(Groups).where(eq(Groups.id, job.groupId));
    if (!meetup || !group || !meetup.adopted) return;
    if (!group.publisherDid) throw new Error("The group publisher account is not connected");
    if (!group.atUri || !group.atCid) throw new Error("The group record has not been published yet");
    if (!meetup.atEventUri || !meetup.atEventCid) throw new Error("The adopted event has no ATProto strong reference");
    const session = await getPdsSession(group.publisherDid);
    if (!session) throw new Error("The group publisher account needs to reauthorize");
    const result = await pdsPut(
      session,
      `at://${group.publisherDid}/${EVENT_META_NSID}/gathering-${meetup.id}`,
      {
        event: { uri: meetup.atEventUri, cid: meetup.atEventCid },
        group: { uri: group.atUri, cid: group.atCid },
        createdAt: meetup.createdAt.toISOString(),
      }
    );
    await db.update(Meetups).set({ atMetaUri: result.uri, atMetaCid: result.cid }).where(eq(Meetups.id, meetup.id));
    return;
  }

  if (!job.payload) return;
  const payload = JSON.parse(job.payload) as DeletePayload;
  const session = await getPdsSession(payload.publisherDid);
  if (!session) throw new Error("The group publisher account needs to reauthorize");
  if (payload.metaUri) await pdsDelete(session, payload.metaUri);
  await pdsDelete(session, payload.eventUri);
}

export interface PublicationReconcileResult {
  processed: number;
  completed: number;
  failed: number;
}

/** Process due publication work. Safe to call from a request and the cron worker. */
export async function reconcilePublicationOutbox(options: { ids?: string[]; limit?: number } = {}): Promise<PublicationReconcileResult> {
  const now = new Date();
  const rows = await db.select().from(PublicationOutbox);
  const candidates = rows
    .filter((job) => (options.ids ? options.ids.includes(job.id) : true))
    .filter((job) => !job.nextAttemptAt || new Date(job.nextAttemptAt) <= now)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, options.limit ?? MAX_ATTEMPTS_PER_RUN);
  let completed = 0;
  let failed = 0;

  for (const job of candidates) {
    try {
      await reconcileJob(job);
      await db.delete(PublicationOutbox).where(eq(PublicationOutbox.id, job.id));
      completed++;
    } catch (error) {
      const attempts = job.attempts + 1;
      await db.update(PublicationOutbox).set({
        attempts,
        lastError: safeError(error),
        nextAttemptAt: retryAt(attempts),
        updatedAt: new Date(),
      }).where(eq(PublicationOutbox.id, job.id));
      console.error(`[publication-outbox] ${job.id} failed:`, safeError(error));
      failed++;
    }
  }
  return { processed: candidates.length, completed, failed };
}
