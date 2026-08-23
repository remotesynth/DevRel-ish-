## What's been built

This is the source code that runs the [DevRel(ish)](https://devrelish.tech) community site — a Meetup.com alternative focused on permanent local groups rather than one-off events.

**`devrelish/`** — complete Astro 6 SSR project

---

### Architecture overview

DevRel(ish) is being migrated to use the **AT Protocol (ATProto)** as its data and identity layer. The migration is in progress; this section reflects the current state.

**Auth:** Users sign in with **any** AT Protocol account via ATProto OAuth — Bluesky, a
community-run PDS, or a self-hosted one. No passwords are stored, and DevRel(ish) runs no PDS
of its own. Attendees need no account at all; only organizers sign in.

**Data (in progress):** Groups and events will be stored as ATProto records on users' Personal Data Servers (PDS). An AppView indexer (Netlify Scheduled Function) will consume the Jetstream firehose and materialize records into a local Turso DB for fast querying. Until the AppView is complete, groups and events are still stored locally.

**Interoperability:** Events use `community.lexicon.calendar.event` and RSVPs use
`community.lexicon.calendar.rsvp` — the same schemas as Smoke Signal, atmo.rsvp, and OpenMeet —
so events are discoverable across the Atmosphere.

---

### Lexicons (`lexicons/`)

Custom ATProto lexicons for DevRel-ish-specific record types.

| Lexicon | File | Purpose |
| ------- | ---- | ------- |
| `com.devrelish.group` | `lexicons/com/devrelish/group.json` | Permanent group identity with location, category, organizer DID |
| `com.devrelish.event.meta` | `lexicons/com/devrelish/event/meta.json` | Extension record linking a group to a community event; adds capacity, speakers, sessions |
| `com.devrelish.membership` | `lexicons/com/devrelish/membership.json` | Member's declared affiliation to a group |

Community lexicons used (not bundled here — referenced by NSID). Canonical source:
[tangled.org/lexicon.community/lexicons](https://tangled.org/lexicon.community/lexicons).

- `community.lexicon.calendar.event` — base event record, shared with Smoke Signal, atmo.rsvp, and OpenMeet
- `community.lexicon.calendar.rsvp` — RSVP record written to the attendee's PDS
- `community.lexicon.location.address` / `.geo` / `.fsq` / `.hthree` — location types embedded in group and event records
- `community.lexicon.app.profile` — DevRel(ish)'s own app profile, declaring which lexicons it produces and consumes

There is deliberately **no** community lexicon for groups or memberships — the
`community.lexicon.calendar` namespace contains only `event` and `rsvp` — which is
why `com.devrelish.group` and `com.devrelish.membership` are custom.

Records are built in one place, `src/lib/atproto-records.ts`, and published through
`src/lib/gatherings.ts`. Event records carry `uris` (so other apps can link back here),
`mode`, `status` (so cancellations propagate), `endsAt`, and `rsvpExpected`.

Reading the other direction: `src/lib/atproto-repo.ts` does unauthenticated
`getRecord`/`listRecords` against any repo, and `src/lib/at-events.ts` holds the display
helpers for records we didn't write. Adoption relies on the fact that every calendar app
writes `community.lexicon.calendar.event` into *the user's own repo* — so listing that one
collection surfaces their events no matter which app created them. Adopted events keep
their original at:// URI and are never overwritten (`Meetups.adopted` guards `syncGathering`).

---

### Database (`db/`)

- `config.ts` — all tables in one place:
  - **App tables:** `Groups`, `Meetups`, `RSVPs`, `GatheringSpeakers`, `GatheringSessions`, `GatheringSessionSpeakers`, `GroupInvites`, `ContactMessages`, `Followers`
  - **Auth tables (ATProto):** `AppUser` (DID-keyed organizer accounts), `AppSession` (session cookie → DID), `OAuthState` (ephemeral OAuth flow state), `OAuthSession` (ATProto token store)
- `seed.ts` — 2 active groups (SF + NYC), 3 gatherings, using placeholder DIDs

---

### Auth (`src/lib/`)

- `atproto-oauth.ts` — `NodeOAuthClient` singleton with Turso-backed state/session stores. Dev mode uses the `http://localhost` special client ID (no keys needed). Production uses `private_key_jwt` with an ES256 key from `ATPROTO_PRIVATE_KEY_JWK`.
- `session.ts` — app session helpers: `createSession`, `getSessionUser`, `deleteSession`, `upsertUser`
- `middleware.ts` — reads `devrelish_session` cookie → looks up `AppSession` → populates `Astro.locals.user`

`Astro.locals.user` shape:
```ts
{
  id: string;          // alias for did
  did: string;         // ATProto DID (e.g. "did:plc:abc123")
  handle: string;      // ATProto handle (e.g. "you.bsky.social", "you.example.com")
  displayName: string | null;
  role: string;        // "admin" | "user"
  groupId: string | null;  // local Groups.id if organizer
}
```

### Pages

| Route | Purpose |
| ----- | ------- |
| `/` | Hero + why section + featured groups |
| `/groups` | All active groups grid |
| `/groups/[slug]` | Group page with upcoming gatherings |
| `/groups/register` | Public group creation form (no approval queue — groups go live immediately) |
| `/gatherings/[id]/rsvp` | Event page: description, speakers, agenda, RSVP form (no login required) |
| `/auth/login` | Sign in with any ATProto handle, DID, or PDS URL (ATProto OAuth) |
| `/oauth/client-metadata.json` | ATProto OAuth client metadata endpoint (required in production) |
| `/api/auth/login` | `POST` — resolves handle → returns ATProto authorization URL |
| `/api/auth/callback` | `GET` — exchanges OAuth code, fetches profile, sets session cookie |
| `/events/[did]/[rkey]` | Read-only page for a calendar event elsewhere in the Atmosphere. Uses the index, falling back to a live read from the owning PDS |
| `/dashboard/gatherings/adopt` | Bring events you already have on Smoke Signal / atmo.rsvp / OpenMeet into your group |
| `/api/import/atproto-events` | `GET` lists calendar events in the organizer's repo; `POST` adopts them |
| `/dashboard/*` | Group organizer views (group edit, gathering management, attendees, speakers & agenda) |
| `/admin/*` | Admin views — list all groups, close/reopen groups that violate the code of conduct |
| `/setup` | First-run admin setup — grants admin role to an ATProto DID |
| `/invite/[token]` | Co-organizer invite acceptance (sign in, then accept) |

---

### Design

- Warm palette (terracotta, sunny yellow, fresh green)
- Bricolage Grotesque display font + Figtree body font
- Full responsive CSS with custom properties — no CSS framework
- Direction and anti-references documented in `.impeccable.md`

---

### External services

| Service | Purpose | Free tier |
| ------- | ------- | --------- |
| [Turso](https://turso.tech) | Hosted libSQL database | 500MB storage, 1B row reads/month |
| [Resend](https://resend.com) | Transactional email (follower notifications, announcements) | 3,000 emails/month |
| [Cloudinary](https://cloudinary.com) | Speaker photo storage | 25 GB storage, 25 GB bandwidth/month |
| Users' own PDS | ATProto identity and record storage — Bluesky, a community server, or self-hosted. DevRel(ish) runs none. | Free |

---

### Local development

```sh
npm install
npm run dev
# Visit http://localhost:4321
```

In development, ATProto OAuth uses the special `http://localhost` client ID — no key generation or metadata endpoint needed. Sign in with any real AT Protocol account.

Speaker photo uploads require Cloudinary credentials. If you don't need that locally, the rest of the site works without them.

The dev seed creates placeholder users with fake DIDs — these can't actually sign in. To test the authenticated dashboard locally, sign in with a real AT Protocol account and manually set `groupId` in the `AppUser` table to one of the seeded group IDs (`group-sf` or `group-nyc`).

---

### Deploy

**One-time setup:**

1. **Create a Turso database**

   ```sh
   turso db create devrelish
   turso db show devrelish --url      # → ASTRO_DB_REMOTE_URL
   turso db tokens create devrelish   # → ASTRO_DB_APP_TOKEN
   ```

2. **Generate an ATProto OAuth key pair** (required for production — identifies your app to users' PDSes):

   ```sh
   node scripts/generate-key.mjs
   ```

   Store the output as `ATPROTO_PRIVATE_KEY_JWK`. Keep it secret — it authenticates your app.

3. **Publish the app profile** (optional, but it's how app directories and other
   event apps discover which lexicons DevRel(ish) speaks):

   ```sh
   APP_PROFILE_HANDLE=devrelish.tech \
   APP_PROFILE_PASSWORD=<app password> \
   node scripts/publish-app-profile.mjs
   ```

   Re-runnable — the record key is the literal `self`, so it updates in place.

4. **Create a Cloudinary account** and copy your credentials from the [Cloudinary Console](https://console.cloudinary.com) → API Keys.

5. **Set Netlify environment variables** (Site settings → Environment variables):

   | Variable | Value |
   | -------- | ----- |
   | `PUBLIC_URL` | Your site URL, e.g. `https://devrelish.tech` |
   | `ATPROTO_PRIVATE_KEY_JWK` | The JSON string from step 2 |
   | `ASTRO_DB_REMOTE_URL` | From Turso |
   | `ASTRO_DB_APP_TOKEN` | From Turso |
   | `CLOUDINARY_CLOUD_NAME` | From Cloudinary |
   | `CLOUDINARY_API_KEY` | From Cloudinary |
   | `CLOUDINARY_API_SECRET` | From Cloudinary |
   | `SETUP_TOKEN` | `openssl rand -base64 24` (temporary — for first admin setup) |

6. **Push the schema to Turso** (run locally once with env vars set):

   ```sh
   npm run db:push
   ```

7. **Deploy to Netlify** — the build command keeps the schema in sync on every future deploy.

8. **Create your admin account:**
   - Visit `https://your-site.netlify.app/setup`
   - Paste the `SETUP_TOKEN`
   - Enter your ATProto DID (resolve it from any AT Protocol server: `https://<your-pds>/xrpc/com.atproto.identity.resolveHandle?handle=<your-handle>`)
   - Sign in via `/auth/login` with your Bluesky account — you'll now have admin access

9. **Remove `SETUP_TOKEN`** from Netlify environment variables once the admin account is set up.
