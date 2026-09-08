import type { APIRoute } from "astro";
import { reconcilePublicationOutbox } from "../../../lib/publication-outbox";
import { hasPublicationWorkerAuthorization } from "../../../lib/publication-worker-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!hasPublicationWorkerAuthorization(request)) {
    return new Response("Not found", { status: 404 });
  }

  const result = await reconcilePublicationOutbox();
  return Response.json(result);
};
