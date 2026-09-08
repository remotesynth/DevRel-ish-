// Unauthenticated reads from any repo on the network.
//
// The Jetstream indexer only sees records created after it starts, so anything
// published before that — or by an account whose events we've never seen — is
// invisible until we go and read it. These helpers do that: resolve the owning
// PDS from the DID, then call the public read endpoints.
//
// No auth is involved. Public records in an ATProto repo are readable by anyone.

import { resolvePdsEndpoint, HANDLE_RE } from "./atproto-identity";

const TIMEOUT_MS = 8_000;

export interface AtUriParts {
  did: string;
  collection: string;
  rkey: string;
}

export interface RepoRecord<T = Record<string, unknown>> {
  uri: string;
  cid: string;
  value: T;
}

/** `at://did/collection/rkey` → its parts, or null if the string isn't one. */
export function parseAtUri(uri: string): AtUriParts | null {
  if (!uri.startsWith("at://")) return null;
  const [did, collection, rkey] = uri.slice("at://".length).split("/");
  if (!did || !collection || !rkey) return null;
  return { did, collection, rkey };
}

export function formatAtUri({ did, collection, rkey }: AtUriParts): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Turn whatever the user pasted into an at:// URI.
 *
 * Accepts the URI itself, or a web URL from an app whose event URLs are
 * mechanically parseable. Smoke Signal uses `/{actor}/{rkey}`; atmo.rsvp and
 * OpenMeet don't publish a documented URL shape, so for those the escape hatch
 * is pasting the at:// URI directly.
 *
 * Returns null when the input isn't recognisable — callers should say so rather
 * than guessing.
 */
export function coerceToAtUri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("at://")) {
    return parseAtUri(trimmed) ? trimmed : null;
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname.endsWith("smokesignal.events") && segments.length === 2) {
    const [actor, rkey] = segments;
    if (actor.startsWith("did:") || HANDLE_RE.test(actor)) {
      return `at://${actor}/community.lexicon.calendar.event/${rkey}`;
    }
  }

  return null;
}

/**
 * Read a single record by at:// URI.
 *
 * The URI's authority may be a handle rather than a DID, in which case we
 * resolve it first — getRecord needs a repo the PDS recognises.
 */
export async function getRecord<T = Record<string, unknown>>(
  uri: string
): Promise<RepoRecord<T> | null> {
  const parts = parseAtUri(uri);
  if (!parts) return null;

  const did = await ensureDid(parts.did);
  if (!did) return null;

  const pds = await resolvePdsEndpoint(did);
  if (!pds) return null;

  const params = new URLSearchParams({
    repo: did,
    collection: parts.collection,
    rkey: parts.rkey,
  });

  try {
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { uri?: string; cid?: string; value?: T };
    if (!body.uri || !body.cid || !body.value) return null;
    return { uri: body.uri, cid: body.cid, value: body.value };
  } catch (err) {
    console.warn("[atproto-repo] getRecord failed for", uri, err);
    return null;
  }
}

/**
 * List every record in a collection for one repo, following pagination.
 *
 * This is what makes migration from other event apps work: they all write
 * `community.lexicon.calendar.event` into the user's own repo, so listing that
 * collection returns their events regardless of which app created them.
 */
export async function listRecords<T = Record<string, unknown>>(
  didOrHandle: string,
  collection: string,
  options: { maxRecords?: number } = {}
): Promise<RepoRecord<T>[]> {
  const max = options.maxRecords ?? 200;

  const did = await ensureDid(didOrHandle);
  if (!did) return [];

  const pds = await resolvePdsEndpoint(did);
  if (!pds) return [];

  const out: RepoRecord<T>[] = [];
  let cursor: string | undefined;

  try {
    while (out.length < max) {
      const params = new URLSearchParams({
        repo: did,
        collection,
        limit: String(Math.min(100, max - out.length)),
      });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) break;

      const body = (await res.json()) as {
        records?: Array<{ uri: string; cid: string; value: T }>;
        cursor?: string;
      };
      const batch = body.records ?? [];
      out.push(...batch);

      // A missing cursor, or a short page, means we've reached the end.
      if (!body.cursor || batch.length === 0) break;
      cursor = body.cursor;
    }
  } catch (err) {
    console.warn("[atproto-repo] listRecords failed for", didOrHandle, collection, err);
  }

  return out;
}

async function ensureDid(didOrHandle: string): Promise<string | null> {
  if (didOrHandle.startsWith("did:")) return didOrHandle;

  // Handles in at:// URIs are legal but must be resolved before use.
  const { resolveHandleToDid } = await import("./atproto-identity");
  return resolveHandleToDid(didOrHandle);
}
