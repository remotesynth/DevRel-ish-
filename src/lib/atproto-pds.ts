import type { OAuthSession } from "@atproto/oauth-client-node";
import { getOAuthClient } from "./atproto-oauth";
import { parseAtUri } from "./atproto-repo";

export type PdsSession = OAuthSession;

// Restore an OAuth session so we can write records to the user's PDS repo.
// Returns null if the session cannot be restored (caller should treat as "no PDS write").
export async function getPdsSession(did: string): Promise<PdsSession | null> {
  try {
    const client = await getOAuthClient();
    return await client.restore(did);
  } catch (err) {
    console.warn("[atproto-pds] Could not restore session for", did, err);
    return null;
  }
}


// Create a new record in the user's repo. Returns the canonical { uri, cid }.
export async function pdsCreate(
  session: PdsSession,
  collection: string,
  record: Record<string, unknown>,
  rkey?: string
): Promise<{ uri: string; cid: string }> {
  const res = await session.fetchHandler("/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: session.did,
      collection,
      ...(rkey ? { rkey } : {}),
      record: { $type: collection, ...record },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`createRecord(${collection}) ${res.status}: ${body.message ?? "unknown"}`);
  }
  return res.json() as Promise<{ uri: string; cid: string }>;
}

// Replace an existing record in-place. Returns the new { uri, cid }.
export async function pdsPut(
  session: PdsSession,
  uri: string,
  record: Record<string, unknown>
): Promise<{ uri: string; cid: string }> {
  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error(`putRecord: not an at:// URI: ${uri}`);
  const { collection, rkey } = parsed;
  const res = await session.fetchHandler("/xrpc/com.atproto.repo.putRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: session.did,
      collection,
      rkey,
      record: { $type: collection, ...record },
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`putRecord(${uri}) ${res.status}: ${body.message ?? "unknown"}`);
  }
  return res.json() as Promise<{ uri: string; cid: string }>;
}

// Delete a record from the user's repo.
export async function pdsDelete(session: PdsSession, uri: string): Promise<void> {
  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error(`deleteRecord: not an at:// URI: ${uri}`);
  const { collection, rkey } = parsed;
  const res = await session.fetchHandler("/xrpc/com.atproto.repo.deleteRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection, rkey }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    // A previous attempt may have reached the PDS just before the database or
    // function timed out. Deletion is therefore idempotent for the outbox.
    if (res.status === 400 && body.error === "RecordNotFound") return;
    throw new Error(`deleteRecord(${uri}) ${res.status}: ${body.message ?? "unknown"}`);
  }
}
