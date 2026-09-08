import { defineMiddleware } from "astro:middleware";
import { hasTrustedRequestOrigin } from "./lib/request-security";
import { hasPublicationWorkerAuthorization } from "./lib/publication-worker-auth";
import { getSessionUser, SESSION_COOKIE } from "./lib/session";

export const onRequest = defineMiddleware(async (context, next) => {
  const isPublicationWorker = context.url.pathname === "/api/internal/reconcile-publications"
    && hasPublicationWorkerAuthorization(context.request);
  if (!isPublicationWorker && !hasTrustedRequestOrigin(context.request, context.url.origin)) {
    return new Response("Forbidden", { status: 403 });
  }

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
