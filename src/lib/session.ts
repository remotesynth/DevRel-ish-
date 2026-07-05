import { db, AppSession, AppUser, eq } from "astro:db";
import { randomUUID } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_COOKIE = "devrelish_session";

export async function createSession(did: string): Promise<string> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(AppSession).values({ id, did, expiresAt });
  return id;
}

export async function getSessionUser(sessionId: string) {
  const [session] = await db
    .select()
    .from(AppSession)
    .where(eq(AppSession.id, sessionId));

  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(AppSession).where(eq(AppSession.id, sessionId));
    return null;
  }

  const [user] = await db
    .select()
    .from(AppUser)
    .where(eq(AppUser.did, session.did));

  return user ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(AppSession).where(eq(AppSession.id, sessionId));
}

export async function upsertUser(opts: {
  did: string;
  handle: string;
  displayName?: string;
}): Promise<void> {
  await db
    .insert(AppUser)
    .values({
      did: opts.did,
      handle: opts.handle,
      displayName: opts.displayName,
      role: "user",
    })
    .onConflictDoUpdate({
      target: AppUser.did,
      set: {
        handle: opts.handle,
        displayName: opts.displayName,
      },
    });
}
