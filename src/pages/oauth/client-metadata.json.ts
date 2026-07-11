import type { APIRoute } from "astro";
import { JoseKey } from "@atproto/jwk-jose";

export const prerender = false;

export const GET: APIRoute = async () => {
  const publicUrl = import.meta.env.PUBLIC_URL;
  if (!publicUrl) {
    return new Response("PUBLIC_URL not configured", { status: 500 });
  }

  const raw = import.meta.env.ATPROTO_PRIVATE_KEY_JWK;
  if (!raw) {
    return new Response(null, { status: 404 });
  }

  let jwks: { keys: object[] };
  try {
    const key = await JoseKey.fromJWK(JSON.parse(raw));
    const pub = key.publicJwk;
    if (!pub) throw new Error("No public JWK");
    jwks = { keys: [pub] };
  } catch {
    return new Response("Invalid ATPROTO_PRIVATE_KEY_JWK", { status: 500 });
  }

  const metadata = {
    client_id: `${publicUrl}/oauth/client-metadata.json`,
    client_name: "DevRel(ish)",
    client_uri: publicUrl,
    redirect_uris: [`${publicUrl}/api/auth/callback`],
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks,
  };

  return new Response(JSON.stringify(metadata), {
    headers: { "content-type": "application/json" },
  });
};
