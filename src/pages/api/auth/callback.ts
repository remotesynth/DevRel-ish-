import type { APIRoute } from "astro";
import { getOAuthClient } from "../../../lib/atproto-oauth";
import { createSession, getSessionUser, upsertUser, SESSION_COOKIE } from "../../../lib/session";
import { resolveHandleFromDid } from "../../../lib/atproto-identity";
import { db, Groups, eq } from "astro:db";
import {
  OAUTH_INTENT_COOKIE,
  OAUTH_INTENT_COOKIE_OPTIONS,
  publisherIntentGroupId,
} from "../../../lib/oauth-intent";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
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

    const publisherGroupId = publisherIntentGroupId(cookies.get(OAUTH_INTENT_COOKIE)?.value);
    if (publisherGroupId) {
      cookies.delete(OAUTH_INTENT_COOKIE, OAUTH_INTENT_COOKIE_OPTIONS);

      const operatorSessionId = cookies.get(SESSION_COOKIE)?.value;
      const operator = operatorSessionId ? await getSessionUser(operatorSessionId) : null;
      const [group] = await db.select().from(Groups).where(eq(Groups.id, publisherGroupId));

      if (!operator || !group || (group.managerId !== operator.did && operator.role !== "admin")) {
        return redirect("/dashboard?error=publisher-authorization");
      }
      if (did === operator.did) {
        return redirect("/dashboard?error=publisher-must-be-separate");
      }

      await db.update(Groups).set({ publisherDid: did }).where(eq(Groups.id, group.id));
      return redirect("/dashboard?publisher=connected");
    }

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
