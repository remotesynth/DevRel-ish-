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
    const message =
      err instanceof Error && err.message.includes("resolve")
        ? "Could not find that Bluesky handle. Please check and try again."
        : "Sign-in failed. Please try again.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
};
