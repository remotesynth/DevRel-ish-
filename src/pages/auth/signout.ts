import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  // Build redirect response, forwarding every Set-Cookie header so the
  // session cookie is properly cleared in the browser.
  const headers = new Headers({ location: "/" });

  // getSetCookie() returns all Set-Cookie values as an array (avoids the
  // single-header join problem with Headers.get("set-cookie")).
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, { status: 302, headers });
};
