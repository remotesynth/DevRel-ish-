import assert from "node:assert/strict";
import test from "node:test";
import { openOAuthValue, sealOAuthValue } from "../src/lib/oauth-storage";

test("OAuth persistence encrypts and authenticates values", () => {
  const plaintext = JSON.stringify({ refresh_token: "sensitive", did: "did:plc:alice" });
  const sealed = sealOAuthValue(plaintext);

  assert.notEqual(sealed, plaintext);
  assert.match(sealed, /^v1\./);
  assert.equal(openOAuthValue(sealed), plaintext);
  assert.throws(() => openOAuthValue(`${sealed.slice(0, -1)}x`));
});
