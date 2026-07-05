import { defineMiddleware } from "astro:middleware";
import { getSessionUser, SESSION_COOKIE } from "./lib/session";

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get(SESSION_COOKIE)?.value ?? null;

  if (sessionId) {
    try {
      const row = await getSessionUser(sessionId);
      if (row) {
        context.locals.user = {
          id: row.did,
          did: row.did,
          handle: row.handle,
          displayName: row.displayName ?? null,
          role: row.role,
          groupId: row.groupId ?? null,
        };
      } else {
        context.locals.user = null;
      }
    } catch (err) {
      console.error("[middleware] session lookup failed:", err);
      context.locals.user = null;
    }
  } else {
    context.locals.user = null;
  }

  return next();
});
