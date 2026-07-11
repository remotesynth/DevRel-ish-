import { JoseKey } from "@atproto/jwk-jose";

const key = await JoseKey.generate(["ES256"]);
console.log("Private key (ATPROTO_PRIVATE_KEY_JWK):");
console.log(JSON.stringify(key.privateJwk));
