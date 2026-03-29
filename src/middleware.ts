import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const session = await auth.api.getSession({
      headers: context.request.headers,
    });
    context.locals.user = session?.user ?? null;
    context.locals.session = session?.session ?? null;
  } catch (err) {
    // Auth unavailable (misconfigured env, DB unreachable, etc.).
    // Log the error server-side but don't crash the request — public
    // pages still render, protected pages redirect via their own guards.
    console.error("[middleware] auth.getSession failed:", err);
    context.locals.user = null;
    context.locals.session = null;
  }

  return next();
});
