import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { db, OAuthState, OAuthSession, eq } from "astro:db";

const isDev = import.meta.env.DEV;

function productionPublicUrl(): string {
  const raw = import.meta.env.PUBLIC_URL ?? process.env.PUBLIC_URL;
  if (!raw) throw new Error("PUBLIC_URL must be configured in production");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PUBLIC_URL must be an absolute URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("PUBLIC_URL must use HTTPS in production");
  }

  return url.origin;
}

function getRedirectUri(): string {
  return isDev
    ? "http://[::1]:4321/api/auth/callback"
    : `${productionPublicUrl()}/api/auth/callback`;
}

// In dev, ATProto allows a special http://localhost client_id that encodes
// redirect_uri and scope in the query string — no keys or metadata doc needed.
function devClientId(): string {
  const params = new URLSearchParams({
    redirect_uri: getRedirectUri(),
    scope: "atproto transition:generic",
  });
  return `http://localhost?${params}`;
}

async function buildKeyset() {
  const raw = import.meta.env.ATPROTO_PRIVATE_KEY_JWK ?? process.env.ATPROTO_PRIVATE_KEY_JWK;
  if (!raw) throw new Error("ATPROTO_PRIVATE_KEY_JWK must be configured in production");
  try {
    const jwk = JSON.parse(raw);
    const key = await JoseKey.fromJWK(jwk);
    return [key];
  } catch (e) {
    console.error("[atproto-oauth] Failed to load ATPROTO_PRIVATE_KEY_JWK:", e);
    throw new Error("ATPROTO_PRIVATE_KEY_JWK is invalid");
  }
}

function makeStores() {
  const stateStore = {
    async set(key: string, value: Record<string, unknown>) {
      const serialized = JSON.stringify(value);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db
        .insert(OAuthState)
        .values({ key, value: serialized, expiresAt })
        .onConflictDoUpdate({
          target: OAuthState.key,
          set: { value: serialized, expiresAt },
        });
    },
    async get(key: string) {
      const [row] = await db
        .select()
        .from(OAuthState)
        .where(eq(OAuthState.key, key));
      if (!row) return undefined;
      if (new Date(row.expiresAt) < new Date()) {
        await db.delete(OAuthState).where(eq(OAuthState.key, key));
        return undefined;
      }
      return JSON.parse(row.value) as Record<string, unknown>;
    },
    async del(key: string) {
      await db.delete(OAuthState).where(eq(OAuthState.key, key));
    },
  };

  const sessionStore = {
    async set(did: string, value: Record<string, unknown>) {
      const serialized = JSON.stringify(value);
      await db
        .insert(OAuthSession)
        .values({ did, value: serialized })
        .onConflictDoUpdate({
          target: OAuthSession.did,
          set: { value: serialized },
        });
    },
    async get(did: string) {
      const [row] = await db
        .select()
        .from(OAuthSession)
        .where(eq(OAuthSession.did, did));
      if (!row) return undefined;
      return JSON.parse(row.value) as Record<string, unknown>;
    },
    async del(did: string) {
      await db.delete(OAuthSession).where(eq(OAuthSession.did, did));
    },
  };

  return { stateStore, sessionStore };
}

let _client: NodeOAuthClient | null = null;

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (_client) return _client;

  const { stateStore, sessionStore } = makeStores();
  const keyset = isDev ? undefined : await buildKeyset();
  const redirectUri = getRedirectUri();
  const publicUrl = isDev ? "http://localhost:4321" : productionPublicUrl();

  _client = new NodeOAuthClient({
    clientMetadata: isDev
      ? {
          client_id: devClientId(),
          client_name: "DevRel(ish) (dev)",
          redirect_uris: [redirectUri],
          scope: "atproto transition:generic",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          application_type: "web",
          token_endpoint_auth_method: "none",
          dpop_bound_access_tokens: true,
        } as any
      : {
          client_id: `${publicUrl}/oauth/client-metadata.json`,
          client_name: "DevRel(ish)",
          client_uri: publicUrl,
          redirect_uris: [redirectUri],
          scope: "atproto transition:generic",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          application_type: "web",
          token_endpoint_auth_method: "private_key_jwt",
          token_endpoint_auth_signing_alg: "ES256",
          dpop_bound_access_tokens: true,
        },
    keyset,
    stateStore: stateStore as any,
    sessionStore: sessionStore as any,
  });

  return _client;
}
