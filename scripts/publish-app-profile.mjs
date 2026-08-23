/**
 * Publish DevRel(ish)'s `community.lexicon.app.profile` record.
 *
 * This is how an app tells the Atmosphere what it is and — the part that
 * matters for us — which lexicons it speaks. App directories and other event
 * apps read it to discover that DevRel(ish) produces and consumes the same
 * calendar records they do.
 *
 * One-off, re-runnable: the record key is the literal `self`, so running this
 * again updates the profile in place.
 *
 * Usage:
 *   APP_PROFILE_HANDLE=devrelish.tech \
 *   APP_PROFILE_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *   node scripts/publish-app-profile.mjs
 *
 * The password is an app password from the account's own service, not the
 * account's real password.
 */

const handle = process.env.APP_PROFILE_HANDLE;
const password = process.env.APP_PROFILE_PASSWORD;
const siteUrl = process.env.PUBLIC_URL ?? "https://devrelish.tech";

if (!handle || !password) {
  console.error(
    "Missing APP_PROFILE_HANDLE and/or APP_PROFILE_PASSWORD.\n" +
      "Set both to the account that should own the DevRel(ish) app profile."
  );
  process.exit(1);
}

const L = "community.lexicon.app.defs";

const profile = {
  $type: "community.lexicon.app.profile",
  name: "DevRel(ish)",
  description:
    "In-person gatherings for developer relations professionals and adjacent " +
    "roles. Permanent local groups rather than one-off events, with everything " +
    "published as open calendar records you own.",
  status: `${L}#preview`,
  tags: ["events", "meetups", "community", "devrel", "calendar"],
  platforms: [`${L}#platformWeb`],
  links: [
    { uri: siteUrl, label: "DevRel(ish)", role: `${L}#linkRoleWebsite` },
    { uri: `${siteUrl}/how-it-works`, label: "How it works", role: `${L}#linkRoleDocs` },
    { uri: `${siteUrl}/privacy`, label: "Privacy policy", role: `${L}#linkRolePrivacyPolicy` },
    {
      uri: "https://github.com/remotesynth/devrelish",
      label: "Source code",
      role: `${L}#linkRoleSourceCode`,
    },
  ],
  // The interop declaration. `produces` is what we write into users' repos;
  // `consumes` is what we index and display from the rest of the network.
  lexicons: {
    produces: [
      "community.lexicon.calendar.event",
      "community.lexicon.calendar.rsvp",
      "com.devrelish.group",
      "com.devrelish.event.meta",
      "com.devrelish.membership",
    ],
    consumes: [
      "community.lexicon.calendar.event",
      "community.lexicon.calendar.rsvp",
      "community.lexicon.location.address",
      "community.lexicon.location.geo",
      "community.lexicon.location.fsq",
      "community.lexicon.location.hthree",
      "com.devrelish.group",
      "com.devrelish.event.meta",
      "com.devrelish.membership",
    ],
  },
  // Records that only DevRel(ish) writes — their presence in a repo is a
  // reliable signal that the account has used this app.
  accountIndicators: [
    { collection: "com.devrelish.group" },
    { collection: "com.devrelish.event.meta" },
    { collection: "com.devrelish.membership" },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function resolvePds(identifier) {
  // Resolve handle -> DID -> PDS endpoint, so this works on any provider.
  let did = identifier;

  if (!identifier.startsWith("did:")) {
    const res = await fetch(`https://${identifier}/.well-known/atproto-did`).catch(() => null);
    if (res?.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith("did:")) did = text;
    }
  }

  if (!did.startsWith("did:")) {
    throw new Error(
      `Could not resolve "${identifier}" to a DID. Serve /.well-known/atproto-did ` +
        `on that domain, or set APP_PROFILE_HANDLE to the DID directly.`
    );
  }

  const docUrl = did.startsWith("did:plc:")
    ? `https://plc.directory/${did}`
    : `https://${did.slice("did:web:".length).replaceAll(":", "/")}/.well-known/did.json`;

  const doc = await (await fetch(docUrl)).json();
  const pds = doc.service?.find((s) => String(s.id).endsWith("#atproto_pds"))?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS endpoint in the DID document for ${did}`);

  return { did, pds: pds.replace(/\/$/, "") };
}

const { did, pds } = await resolvePds(handle);
console.log(`Resolved ${handle} → ${did} @ ${pds}`);

const authRes = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: did, password }),
});
if (!authRes.ok) {
  console.error(`Sign-in failed (${authRes.status}):`, await authRes.text());
  process.exit(1);
}
const { accessJwt } = await authRes.json();

const putRes = await fetch(`${pds}/xrpc/com.atproto.repo.putRecord`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessJwt}`,
  },
  body: JSON.stringify({
    repo: did,
    collection: "community.lexicon.app.profile",
    rkey: "self",
    record: profile,
  }),
});

if (!putRes.ok) {
  console.error(`putRecord failed (${putRes.status}):`, await putRes.text());
  process.exit(1);
}

const { uri, cid } = await putRes.json();
console.log(`Published app profile:\n  ${uri}\n  cid ${cid}`);
