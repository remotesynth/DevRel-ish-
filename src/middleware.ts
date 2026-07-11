import { defineMiddleware } from "astro:middleware";
import { getSessionUser, isAdminHandle, promoteToAdmin, SESSION_COOKIE } from "./lib/session";

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get(SESSION_COOKIE)?.value ?? null;

  if (sessionId) {
    try {
      const row = await getSessionUser(sessionId);
      if (row) {
        let role = row.role;

        // If the handle is in ADMIN_HANDLES but the DB row isn't admin yet,
        // promote now — handles already-logged-in users after the env var is set.
        if (role !== "admin" && isAdminHandle(row.handle)) {
          await promoteToAdmin(row.did);
          role = "admin";
        }

        context.locals.user = {
          id: row.did,
          did: row.did,
          handle: row.handle,
          displayName: row.displayName ?? null,
          role,
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
