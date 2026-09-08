import { PUBLICATION_WORKER_HEADER } from "../../src/lib/publication-worker-auth";

// Matches the indexer's cadence while keeping the free-tier operational cost
// predictable. Immediate request attempts still make the normal case fast.
export const config = { schedule: "*/15 * * * *" };

export default async function handler(): Promise<void> {
  const siteUrl = process.env.PUBLIC_URL;
  const secret = process.env.PUBLICATION_RECONCILE_SECRET;
  if (!siteUrl || !secret) {
    console.error("[publication-reconciler] Missing PUBLIC_URL or PUBLICATION_RECONCILE_SECRET");
    return;
  }

  const response = await fetch(new URL("/api/internal/reconcile-publications", siteUrl), {
    method: "POST",
    headers: { [PUBLICATION_WORKER_HEADER]: secret },
  });
  if (!response.ok) {
    console.error(`[publication-reconciler] Reconciliation failed: ${response.status}`);
    return;
  }
  console.log("[publication-reconciler]", await response.text());
}
