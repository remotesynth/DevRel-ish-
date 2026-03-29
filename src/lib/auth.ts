import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db, User, Session, Account, Verification } from "astro:db";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:4321";

export const auth = betterAuth({
  baseURL,
  database: drizzleAdapter(db as any, {
    provider: "sqlite",
    // AstroDB exports tables with capital names; better-auth looks them up
    // by lowercase model name, so we provide the mapping explicitly.
    schema: {
      user: User,
      session: Session,
      account: Account,
      verification: Verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
  user: {
    additionalFields: {
      groupId: {
        type: "string",
        required: false,
        input: false, // not settable via sign-up
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  trustedOrigins: [baseURL],
});
