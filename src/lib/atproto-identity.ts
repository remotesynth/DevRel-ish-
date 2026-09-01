// Identity resolution that doesn't assume any particular provider.
//
// The obvious shortcut is to resolve handles against public.api.bsky.app, but
// that quietly makes Bluesky a dependency for identities that have nothing to do
// with it. These helpers use the protocol's own mechanisms instead.

import type { PdsSession } from "./atproto-pds";
import { safeExternalHttpsUrl } from "./safe-external-url";

const TIMEOUT_MS = 4_000;

/**
 * Resolve a handle to a DID.
 *
 * Order matters:
 *  1. `https://<handle>/.well-known/atproto-did` — the domain speaks for itself,
 *     no third party involved. Covers every custom-domain handle.
 *  2. `com.atproto.identity.resolveHandle` on the caller's OWN PDS, when we have
 *     a session. Their server does the DNS/well-known work; we don't have to
 *     pick someone else's server to trust.
 *
 * DNS TXT (`_atproto.<handle>`) is the third mechanism in the spec, but it isn't
 * reachable from a serverless fetch runtime — step 2 covers it indirectly.
 *
 * Returns null when the handle can't be resolved, which callers should treat as
 * "unverified", not "invalid".
 */
export async function resolveHandleToDid(
  handle: string,
  session?: PdsSession | null
): Promise<string | null> {
  const clean = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!clean) return null;

  // 1. The handle's own domain.
  try {
    const url = await safeExternalHttpsUrl(`https://${clean}/.well-known/atproto-did`);
    if (url) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const did = (await res.text()).trim();
        if (did.startsWith("did:")) return did;
      }
    }
  } catch {
    // Not every handle serves .well-known — fall through.
  }

  // 2. The caller's own PDS.
  if (session) {
    try {
      const res = await session.fetchHandler(
        `/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`,
        { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (res.ok) {
        const { did } = (await res.json()) as { did?: string };
        if (did?.startsWith("did:")) return did;
      }
    } catch {
      // Fall through to "unverified".
    }
  }

  return null;
}

/**
 * Resolve a DID to its primary handle via the DID document.
 * Works for any provider: did:plc goes to the PLC directory, did:web to the domain.
 * Returns the DID unchanged when resolution fails, so callers always have something
 * displayable.
 */
export async function resolveHandleFromDid(did: string): Promise<string> {
  const doc = await fetchDidDocument(did);
  if (!doc) return did;

  // alsoKnownAs entries are "at://" URIs: "at://alice.example.com"
  const aka: string = (doc.alsoKnownAs as string[] | undefined)?.[0] ?? "";
  return aka.startsWith("at://") ? aka.slice("at://".length) : did;
}

/**
 * Find the PDS endpoint for a DID, so we can read records straight from the repo
 * that owns them. Needed for any account whose records we didn't write ourselves.
 */
export async function resolvePdsEndpoint(did: string): Promise<string | null> {
  const doc = await fetchDidDocument(did);
  if (!doc) return null;

  const services = (doc.service as Array<Record<string, unknown>> | undefined) ?? [];
  const pds = services.find(
    (s) =>
      typeof s.id === "string" &&
      (s.id === "#atproto_pds" || s.id.endsWith("#atproto_pds"))
  );
  const endpoint = pds?.serviceEndpoint;
  if (typeof endpoint !== "string") return null;
  const safe = await safeExternalHttpsUrl(endpoint);
  return safe?.toString().replace(/\/$/, "") ?? null;
}

async function fetchDidDocument(did: string): Promise<Record<string, unknown> | null> {
  let url: string;

  if (did.startsWith("did:plc:")) {
    url = `https://plc.directory/${did}`;
  } else if (did.startsWith("did:web:")) {
    // did:web:example.com → https://example.com/.well-known/did.json
    // did:web:example.com:path → https://example.com/path/did.json
    const suffix = did.slice("did:web:".length).replaceAll(":", "/");
    url = suffix.includes("/")
      ? `https://${suffix}/did.json`
      : `https://${suffix}/.well-known/did.json`;
  } else {
    return null;
  }

  try {
    const safe = await safeExternalHttpsUrl(url);
    if (!safe) return null;
    const res = await fetch(safe, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A valid handle is 2+ dot-separated segments of letters/digits/hyphens,
 * with no leading or trailing hyphen in any segment.
 */
export const HANDLE_RE =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

/** Where to send someone to view an account, given its handle. */
export function profileUrl(handle: string): string {
  const clean = handle.replace(/^@+/, "");
  // No universal profile viewer exists yet; bsky.app renders any DID's public
  // profile regardless of which PDS hosts it, so it's the pragmatic choice.
  return `https://bsky.app/profile/${clean}`;
}
