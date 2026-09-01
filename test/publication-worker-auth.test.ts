import assert from "node:assert/strict";
import test from "node:test";
import { hasPublicationWorkerAuthorization, PUBLICATION_WORKER_HEADER } from "../src/lib/publication-worker-auth";

test("publication reconciler requires its dedicated secret", () => {
  const previous = process.env.PUBLICATION_RECONCILE_SECRET;
  process.env.PUBLICATION_RECONCILE_SECRET = "test-publication-secret";
  try {
    assert.equal(hasPublicationWorkerAuthorization(new Request("https://example.test/api/internal/reconcile-publications")), false);
    assert.equal(hasPublicationWorkerAuthorization(new Request("https://example.test/api/internal/reconcile-publications", {
      headers: { [PUBLICATION_WORKER_HEADER]: "wrong" },
    })), false);
    assert.equal(hasPublicationWorkerAuthorization(new Request("https://example.test/api/internal/reconcile-publications", {
      headers: { [PUBLICATION_WORKER_HEADER]: "test-publication-secret" },
    })), true);
  } finally {
    if (previous === undefined) delete process.env.PUBLICATION_RECONCILE_SECRET;
    else process.env.PUBLICATION_RECONCILE_SECRET = previous;
  }
});
