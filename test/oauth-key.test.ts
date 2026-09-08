import assert from "node:assert/strict";
import test from "node:test";
import { JoseKey } from "@atproto/jwk-jose";
import { loadOAuthSigningKey, OAUTH_KEY_ID } from "../src/lib/oauth-key";

test("OAuth keys without a key ID publish a safe public JWK", async () => {
  // The prior generator did not include `kid`, so JSON serialization produces
  // the same shape already stored in existing deployment configuration.
  const generated = await JoseKey.generate(["ES256"]);
  const loaded = await loadOAuthSigningKey(JSON.stringify(generated.privateJwk));
  const publicJwk = loaded.publicJwk;

  assert.equal(loaded.kid, OAUTH_KEY_ID);
  assert.ok(publicJwk);
  assert.equal("d" in JSON.parse(JSON.stringify(publicJwk)), false);
  assert.equal(publicJwk.kty, "EC");
});
