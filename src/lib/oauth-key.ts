import { JoseKey } from "@atproto/jwk-jose";

// The ATProto JWK helper needs a key ID to derive and publish the matching
// public JWK. Keep this stable across deployments and key rotations.
export const OAUTH_KEY_ID = "devrelish-oauth";

/** Parse the configured OAuth signing key and supply an ID for older keys. */
export async function loadOAuthSigningKey(raw: string): Promise<JoseKey> {
  return JoseKey.fromJWK(JSON.parse(raw), OAUTH_KEY_ID);
}
