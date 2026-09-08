import type { APIRoute } from "astro";
import { getOAuthClient } from "../../lib/atproto-oauth";
import { deleteSession, getSessionUser, SESSION_COOKIE } from "../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value ?? null;

  if (sessionId) {
    try {
      const user = await getSessionUser(sessionId);
      if (user) {
        const client = await getOAuthClient();
        await client.revoke(user.did).catch(() => {});
      }
      await deleteSession(sessionId);
    } catch (err) {
      console.error("[signout]", err);
    }
  }

  const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(null, {
    status: 302,
    headers: { location: "/", "set-cookie": clearCookie },
  });
};
