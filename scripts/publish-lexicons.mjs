/**
 * Publish DevRel(ish)'s authoritative custom Lexicons to an ATProto repo.
 *
 * Usage:
 *   LEXICON_PUBLISHER_HANDLE=devrelish.tech \
 *   LEXICON_PUBLISHER_PASSWORD=<app-password> \
 *   node scripts/publish-lexicons.mjs
 *
 * Create the required `_lexicon` DNS TXT records first; see README.md.
 */
import { readFile } from "node:fs/promises";

const handle = process.env.LEXICON_PUBLISHER_HANDLE ?? process.env.APP_PROFILE_HANDLE;
const password = process.env.LEXICON_PUBLISHER_PASSWORD ?? process.env.APP_PROFILE_PASSWORD;
const schemaFiles = [
  new URL("../lexicons/tech/devrelish/group.json", import.meta.url),
  new URL("../lexicons/tech/devrelish/event/meta.json", import.meta.url),
  new URL("../lexicons/tech/devrelish/membership.json", import.meta.url),
];

if (!handle || !password) {
  console.error("Missing LEXICON_PUBLISHER_HANDLE and/or LEXICON_PUBLISHER_PASSWORD (an app password).");
  process.exit(1);
}

async function resolvePds(identifier) {
  let did = identifier;
  if (!did.startsWith("did:")) {
    const response = await fetch(`https://${identifier}/.well-known/atproto-did`).catch(() => null);
    if (response?.ok) {
      const resolved = (await response.text()).trim();
      if (resolved.startsWith("did:")) did = resolved;
    }
  }
  if (!did.startsWith("did:")) throw new Error(`Could not resolve ${identifier} to a DID`);

  const docUrl = did.startsWith("did:plc:")
    ? `https://plc.directory/${did}`
    : `https://${did.slice("did:web:".length).replaceAll(":", "/")}/.well-known/did.json`;
  const doc = await (await fetch(docUrl)).json();
  const pds = doc.service?.find((service) => String(service.id).endsWith("#atproto_pds"))?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS endpoint in the DID document for ${did}`);
  return { did, pds: pds.replace(/\/$/, "") };
}

const { did, pds } = await resolvePds(handle);
const auth = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: did, password }),
});
if (!auth.ok) throw new Error(`Sign-in failed (${auth.status}): ${await auth.text()}`);
const { accessJwt } = await auth.json();

for (const file of schemaFiles) {
  const lexicon = JSON.parse(await readFile(file, "utf8"));
  const response = await fetch(`${pds}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: "com.atproto.lexicon.schema",
      rkey: lexicon.id,
      record: { $type: "com.atproto.lexicon.schema", ...lexicon },
    }),
  });
  if (!response.ok) throw new Error(`Could not publish ${lexicon.id} (${response.status}): ${await response.text()}`);
  console.log(`Published ${lexicon.id}`);
}
