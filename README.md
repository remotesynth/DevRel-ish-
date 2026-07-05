## What's been built

This is the source code that runs the [DevRel(ish)](https://devrelish.tech) community site — a Meetup.com alternative focused on permanent local groups rather than one-off events.

**`devrelish/`** — complete Astro 6 SSR project

---

### Architecture overview

DevRel(ish) is being migrated to use the **AT Protocol (ATProto)** as its data and identity layer. The migration is in progress; this section reflects the current state.

**Auth:** Users sign in with their Bluesky account via ATProto OAuth. No passwords are stored.

**Data (in progress):** Groups and events will be stored as ATProto records on users' Personal Data Servers (PDS). An AppView indexer (Netlify Scheduled Function) will consume the Jetstream firehose and materialize records into a local Turso DB for fast querying. Until the AppView is complete, groups and events are still stored locally.

**Interoperability:** Events use `community.lexicon.calendar.event` and RSVPs use `community.lexicon.calendar.rsvp` — the same schemas as Smoke Signal — so events are discoverable across the ATProto ecosystem.

---

### Lexicons (`lexicons/`)

Custom ATProto lexicons for DevRel-ish-specific record types.

| Lexicon | File | Purpose |
| ------- | ---- | ------- |
| `com.devrelish.group` | `lexicons/com/devrelish/group.json` | Permanent group identity with location, category, organizer DID |
| `com.devrelish.event.meta` | `lexicons/com/devrelish/event/meta.json` | Extension record linking a group to a community event; adds capacity, speakers, sessions |
| `com.devrelish.membership` | `lexicons/com/devrelish/membership.json` | Member's declared affiliation to a group |

Community lexicons used (not bundled here — referenced by NSID):
- `community.lexicon.calendar.event` — base event record (shared with Smoke Signal)
- `community.lexicon.calendar.rsvp` — RSVP record written to the attendee's PDS
- `community.lexicon.location.address` / `.geo` — location types embedded in group and event records

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
  handle: string;      // Bluesky handle (e.g. "you.bsky.social")
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
| `/auth/login` | Sign in with Bluesky handle (ATProto OAuth) |
| `/oauth/client-metadata.json` | ATProto OAuth client metadata endpoint (required in production) |
| `/api/auth/login` | `POST` — resolves handle → returns ATProto authorization URL |
| `/api/auth/callback` | `GET` — exchanges OAuth code, fetches profile, sets session cookie |
| `/dashboard/*` | Group organizer views (group edit, gathering management, attendees, speakers & agenda) |
| `/admin/*` | Admin views — list all groups, close/reopen groups that violate the code of conduct |
| `/setup` | First-run admin setup — grants admin role to an ATProto DID |
| `/invite/[token]` | Co-organizer invite acceptance (sign in with Bluesky then accept) |

---

### Design

- Warm, whimsical palette (terracotta, sunny yellow, fresh green)
- Fredoka One display font + Nunito body font
- Full responsive CSS with custom properties — no CSS framework

---

### External services

| Service | Purpose | Free tier |
| ------- | ------- | --------- |
| [Turso](https://turso.tech) | Hosted libSQL database | 500MB storage, 1B row reads/month |
| [Resend](https://resend.com) | Transactional email (follower notifications, announcements) | 3,000 emails/month |
| [Cloudinary](https://cloudinary.com) | Speaker photo storage | 25 GB storage, 25 GB bandwidth/month |
| [Bluesky PDS](https://bsky.social) | ATProto identity and record storage (users' existing accounts) | Free |

---

### Local development

```sh
npm install
npm run dev
# Visit http://localhost:4321
```

In development, ATProto OAuth uses the special `http://localhost` client ID — no key generation or metadata endpoint needed. Sign in with any real Bluesky account.

Speaker photo uploads require Cloudinary credentials. If you don't need that locally, the rest of the site works without them.

The dev seed creates placeholder users with fake DIDs — these can't actually sign in. To test the authenticated dashboard locally, sign in with a real Bluesky account and manually set `groupId` in the `AppUser` table to one of the seeded group IDs (`group-sf` or `group-nyc`).

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
   node -e "
     const { JoseKey } = require('@atproto/jwk-jose');
     JoseKey.generate(['ES256']).then(k => {
       console.log('Private key (ATPROTO_PRIVATE_KEY_JWK):');
       console.log(JSON.stringify(k.privateJwk));
     });
   "
   ```

   Store the output as `ATPROTO_PRIVATE_KEY_JWK`. Keep it secret — it authenticates your app.

3. **Create a Cloudinary account** and copy your credentials from the [Cloudinary Console](https://console.cloudinary.com) → API Keys.

4. **Set Netlify environment variables** (Site settings → Environment variables):

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

5. **Push the schema to Turso** (run locally once with env vars set):

   ```sh
   npm run db:push
   ```

6. **Deploy to Netlify** — the build command keeps the schema in sync on every future deploy.

7. **Create your admin account:**
   - Visit `https://your-site.netlify.app/setup`
   - Paste the `SETUP_TOKEN`
   - Enter your ATProto DID (find it at `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=yourdomain.bsky.social`)
   - Sign in via `/auth/login` with your Bluesky account — you'll now have admin access

8. **Remove `SETUP_TOKEN`** from Netlify environment variables once the admin account is set up.
