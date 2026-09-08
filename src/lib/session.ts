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

// DIDs are stable identifiers; handles can be transferred or renamed. Evaluate
// this on each call so a deployment-level configuration change takes effect
// without a server restart.
function getAdminDids(): Set<string> {
  return new Set(
    // Astro/Vite exposes .env vars via import.meta.env; process.env is a fallback
    // for contexts where import.meta isn't transformed (e.g. some Netlify runtimes).
    (import.meta.env.ADMIN_DIDS ?? process.env.ADMIN_DIDS ?? "")
      .split(",")
      .map((did: string) => did.trim())
      .filter(Boolean)
  );
}

export function isAdminDid(did: string): boolean {
  const adminDids = getAdminDids();
  return adminDids.size > 0 && adminDids.has(did);
}

export async function promoteToAdmin(did: string): Promise<void> {
  await db.update(AppUser).set({ role: "admin" }).where(eq(AppUser.did, did));
}

export async function upsertUser(opts: {
  did: string;
  handle: string;
  displayName?: string;
}): Promise<void> {
  const isAdmin = isAdminDid(opts.did);
  await db
    .insert(AppUser)
    .values({
      did: opts.did,
      handle: opts.handle,
      displayName: opts.displayName,
      role: isAdmin ? "admin" : "user",
    })
    .onConflictDoUpdate({
      target: AppUser.did,
      set: {
        handle: opts.handle,
        displayName: opts.displayName,
        // Only promote, never auto-demote — removing the env var doesn't strip
        // admin from an account that was already manually promoted.
        ...(isAdmin ? { role: "admin" } : {}),
      },
    });
}
