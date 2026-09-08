import { timingSafeEqual } from "node:crypto";

const HEADER = "x-devrelish-publication-key";

function configuredSecret(): string | undefined {
  return import.meta.env?.PUBLICATION_RECONCILE_SECRET ?? process.env.PUBLICATION_RECONCILE_SECRET;
}

/** Authenticate the Netlify scheduler before bypassing browser-origin checks. */
export function hasPublicationWorkerAuthorization(request: Request): boolean {
  const expected = configuredSecret();
  const received = request.headers.get(HEADER);
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export const PUBLICATION_WORKER_HEADER = HEADER;
