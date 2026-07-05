import type { APIRoute } from "astro";
import { db, AppUser, count } from "astro:db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const env = {
    PUBLIC_URL: process.env.PUBLIC_URL ?? "(not set — falls back to localhost)",
    ATPROTO_PRIVATE_KEY_JWK: !!process.env.ATPROTO_PRIVATE_KEY_JWK,
    ASTRO_DB_REMOTE_URL: !!process.env.ASTRO_DB_REMOTE_URL,
    ASTRO_DB_APP_TOKEN: !!process.env.ASTRO_DB_APP_TOKEN,
  };

  let db_ok = false;
  let db_error: string | null = null;
  try {
    await db.select({ val: count() }).from(AppUser);
    db_ok = true;
  } catch (err) {
    db_error = err instanceof Error ? err.message : String(err);
  }

  const status = db_ok ? 200 : 503;

  return new Response(
    JSON.stringify({ env, db_ok, db_error }, null, 2),
    { status, headers: { "Content-Type": "application/json" } }
  );
};
