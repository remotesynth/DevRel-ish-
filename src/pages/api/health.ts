import type { APIRoute } from "astro";
import { db, User } from "astro:db";
import { count } from "astro:db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const env = {
    BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "(not set — falls back to localhost)",
    ASTRO_DB_REMOTE_URL: !!process.env.ASTRO_DB_REMOTE_URL,
    ASTRO_DB_APP_TOKEN: !!process.env.ASTRO_DB_APP_TOKEN,
  };

  let db_ok = false;
  let db_error: string | null = null;
  try {
    await db.select({ val: count() }).from(User);
    db_ok = true;
  } catch (err) {
    db_error = err instanceof Error ? err.message : String(err);
  }

  let auth_ok = false;
  let auth_error: string | null = null;
  try {
    const { auth } = await import("../../lib/auth");
    await auth.api.getSession({ headers: new Headers() });
    auth_ok = true;
  } catch (err) {
    auth_error = err instanceof Error ? err.message : String(err);
  }

  const status = db_ok && auth_ok ? 200 : 503;

  return new Response(
    JSON.stringify({ env, db_ok, db_error, auth_ok, auth_error }, null, 2),
    { status, headers: { "Content-Type": "application/json" } }
  );
};
