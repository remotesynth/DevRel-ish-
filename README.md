## What's been built

**`devrelish/`** — complete Astro 6 SSR project

### Database (`db/`)

- `config.ts` — all app tables (`Groups`, `Meetups`, `RSVPs`) + better-auth tables (`User`, `Session`, `Account`, `Verification`) in one place
- `seed.ts` — 2 approved groups (SF + NYC), 1 pending (Austin), 3 gatherings

### Auth (`src/lib/`)

- `auth.ts` — better-auth with drizzle adapter, admin plugin, email/password
- `auth-client.ts` — browser client for React components
- `middleware.ts` — injects `user`/`session` into `Astro.locals` on every request

### Pages

| Route                   | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `/`                     | Hero + why section + featured groups                              |
| `/groups`               | All approved groups grid                                          |
| `/groups/[slug]`        | Group page with upcoming gatherings                               |
| `/groups/register`      | Public group application form                                     |
| `/gatherings/[id]/rsvp` | RSVP form (no auth required)                                      |
| `/auth/login`           | Email/password sign-in                                            |
| `/dashboard/*`          | Group manager views (group edit, gathering management, attendees) |
| `/admin/*`              | Admin queue to approve/reject applications                        |

### Design

- Warm, whimsical palette (terracotta, sunny yellow, fresh green)
- Fredoka One display font + Nunito body font
- Full responsive CSS with custom properties — no CSS framework

### To get started locally

```sh
# Generate a real secret
openssl rand -base64 32  # paste into .env as BETTER_AUTH_SECRET

npm run dev
# Visit http://localhost:4321
```

To create your first admin user you'll need to call the better-auth API to sign up and then manually set `role = "admin"` in the database, or add it to the seed file.

| Email                | Password        | Role                |
| -------------------- | --------------- | ------------------- |
| admin@devrelish.tech | admin-devrelish | Admin               |
| alex@example.com     | alex-devrelish  | Group manager (SF)  |
| sam@example.com      | sam-devrelish   | Group manager (NYC) |

## Deploy

**One-time setup (do these before the first deploy):**

1. **Create a Turso database**

   ```sh
   turso db create devrelish
   turso db show devrelish --url      # → ASTRO_DB_REMOTE_URL
   turso db tokens create devrelish   # → ASTRO_DB_APP_TOKEN
   ```

2. **Set Netlify environment variables** (Site settings → Environment variables):
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
   - `BETTER_AUTH_URL` — your Netlify URL (e.g. `https://<your-site>.netlify.app`)
   - `ASTRO_DB_REMOTE_URL` — from Turso above
   - `ASTRO_DB_APP_TOKEN` — from Turso above
   - `SETUP_TOKEN` — `openssl rand -base64 24` (temporary, for admin setup)

3. **Push the schema to Turso** (run locally once with the env vars set):

   ```sh
   npm run db:push
   ```

4. **Deploy to Netlify** — the build command (`astro db push --remote && astro build`) will keep the schema in sync on every future deploy automatically.

5. **Create your admin account** — visit `https://your-site.netlify.app/setup`, paste the `SETUP_TOKEN`, fill in your name/email/password.

6. **Remove `SETUP_TOKEN`** from Netlify environment variables — this permanently disables the `/setup` page (it shows "Already configured" anyway once an admin exists, but removing the token is belt-and-suspenders).
