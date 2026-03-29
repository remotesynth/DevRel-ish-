## What's been built

**`devrelish/`** — complete Astro 6 SSR project

### Database (`db/`)

- `config.ts` — all app tables (`Groups`, `Meetups`, `RSVPs`) + better-auth tables (`User`, `Session`, `Account`, `Verification`) in one place
- `seed.ts` — 2 approved groups (SF + NYC), 1 pending (Austin), 3 meetups

### Auth (`src/lib/`)

- `auth.ts` — better-auth with drizzle adapter, admin plugin, email/password
- `auth-client.ts` — browser client for React components
- `middleware.ts` — injects `user`/`session` into `Astro.locals` on every request

### Pages

| Route                | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `/`                  | Hero + why section + featured groups                           |
| `/groups`            | All approved groups grid                                       |
| `/groups/[slug]`     | Group page with upcoming meetups                               |
| `/groups/register`   | Public group application form                                  |
| `/meetups/[id]/rsvp` | RSVP form (no auth required)                                   |
| `/auth/login`        | Email/password sign-in                                         |
| `/dashboard/*`       | Group manager views (group edit, meetup management, attendees) |
| `/admin/*`           | Admin queue to approve/reject applications                     |

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

┌──────────────────────┬─────────────────┬─────────────────────┐
│        Email         │    Password     │        Role         |
├──────────────────────┼─────────────────┼─────────────────────┤      
│ admin@devrelish.tech │ admin-devrelish │ Admin               │
├──────────────────────┼─────────────────┼─────────────────────┤
│ alex@example.com     │ alex-devrelish  │ Group manager (SF)  │ 
├──────────────────────┼─────────────────┼─────────────────────┤
│ sam@example.com      │ sam-devrelish   │ Group manager (NYC) │
└──────────────────────┴─────────────────┴─────────────────────┘     