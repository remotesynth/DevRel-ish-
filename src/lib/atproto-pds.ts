import type { OAuthSession } from "@atproto/oauth-client-node";
import { getOAuthClient } from "./atproto-oauth";

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

// at://did/collection/rkey → { did, collection, rkey }
function parseAtUri(uri: string): { did: string; collection: string; rkey: string } {
  const parts = uri.split("/");
  return { did: parts[2], collection: parts[3], rkey: parts[4] };
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
  const { collection, rkey } = parseAtUri(uri);
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
  const { collection, rkey } = parseAtUri(uri);
  const res = await session.fetchHandler("/xrpc/com.atproto.repo.deleteRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection, rkey }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`deleteRecord(${uri}) ${res.status}: ${body.message ?? "unknown"}`);
  }
}
