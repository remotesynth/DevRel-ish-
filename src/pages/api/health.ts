import type { APIRoute } from "astro";
import { db, AppUser, count } from "astro:db";

export const prerender = false;

export const GET: APIRoute = async () => {
  let db_ok = false;
  try {
    await db.select({ val: count() }).from(AppUser);
    db_ok = true;
  } catch {
    // Do not expose database topology or error details from a public endpoint.
  }

  const status = db_ok ? 200 : 503;

  return new Response(
    JSON.stringify({ ok: db_ok }),
    { status, headers: { "Content-Type": "application/json" } }
  );
};
