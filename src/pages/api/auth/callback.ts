import type { APIRoute } from "astro";
import { getOAuthClient } from "../../../lib/atproto-oauth";
import { createSession, upsertUser, SESSION_COOKIE } from "../../../lib/session";

export const prerender = false;

async function resolveHandleFromDid(did: string): Promise<string> {
  let didDocUrl: string;

  if (did.startsWith("did:plc:")) {
    didDocUrl = `https://plc.directory/${did}`;
  } else if (did.startsWith("did:web:")) {
    // did:web:example.com → https://example.com/.well-known/did.json
    // did:web:example.com:path → https://example.com/path/did.json
    const suffix = did.slice("did:web:".length).replaceAll(":", "/");
    didDocUrl = `https://${suffix}/.well-known/did.json`;
  } else {
    return did;
  }

  const res = await fetch(didDocUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return did;

  const doc = await res.json();
  const aka: string = doc.alsoKnownAs?.[0] ?? "";
  // alsoKnownAs entries use the "at://" prefix: "at://alice.example.com"
  return aka.startsWith("at://") ? aka.slice("at://".length) : did;
}

export const GET: APIRoute = async ({ url, redirect }) => {
  const params = url.searchParams;

  if (params.get("error")) {
    const desc = params.get("error_description") ?? params.get("error");
    console.error("[auth/callback] OAuth error:", desc);
    return redirect(`/auth/login?error=${encodeURIComponent("Sign-in was cancelled or failed.")}`);
  }

  try {
    const client = await getOAuthClient();
    const { session } = await client.callback(params);

    const did = session.did;

    // Resolve handle from the DID document — works for any ATProto PDS,
    // not just Bluesky. did:plc → PLC directory; did:web → .well-known/did.json
    let handle: string = did;
    try {
      handle = await resolveHandleFromDid(did);
    } catch (err) {
      console.warn("[auth/callback] Handle resolution failed, using DID:", err);
    }

    await upsertUser({ did, handle });
    const sessionId = await createSession(did);

    const isDev = import.meta.env.DEV;
    const cookieOpts = [
      `${SESSION_COOKIE}=${sessionId}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${7 * 24 * 60 * 60}`,
      ...(!isDev ? ["Secure"] : []),
    ].join("; ");

    return new Response(null, {
      status: 302,
      headers: {
        location: "/dashboard",
        "set-cookie": cookieOpts,
      },
    });
  } catch (err) {
    console.error("[auth/callback] callback failed:", err);
    return redirect("/auth/login?error=" + encodeURIComponent("Sign-in failed. Please try again."));
  }
};
