import type { APIRoute } from "astro";
import { getOAuthClient } from "../../../lib/atproto-oauth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let handle: string;
  try {
    const body = await request.json();
    handle = String(body?.handle ?? "").trim();
    if (!handle) throw new Error("empty");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const client = await getOAuthClient();
    const url = await client.authorize(handle, {
      scope: "atproto transition:generic",
    });
    return new Response(JSON.stringify({ url: url.toString() }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[auth/login] authorize failed:", err);
    // Distinguish "we couldn't find this identity" from "we found it but its
    // server didn't answer" — the fix is different for each.
    const raw = err instanceof Error ? err.message.toLowerCase() : "";
    let message: string;
    if (raw.includes("resolve") || raw.includes("not found") || raw.includes("invalid handle")) {
      message =
        "We couldn't find that account. Check the spelling — you can enter a handle " +
        "(you.bsky.social), a DID (did:plc:…), or your server's URL.";
    } else if (raw.includes("fetch") || raw.includes("timeout") || raw.includes("network") || raw.includes("econn")) {
      message =
        "We found that account but couldn't reach its server. It may be down — try again in a moment.";
    } else {
      message = "Sign-in failed. Please try again.";
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
};
