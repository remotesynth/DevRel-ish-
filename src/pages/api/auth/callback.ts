import type { APIRoute } from "astro";
import { getOAuthClient } from "../../../lib/atproto-oauth";
import { createSession, upsertUser, SESSION_COOKIE } from "../../../lib/session";
import { resolveHandleFromDid } from "../../../lib/atproto-identity";

export const prerender = false;

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

    // Resolve handle from the DID document — works for any ATProto PDS.
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
