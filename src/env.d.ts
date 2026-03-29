/// <reference types="astro/client" />

type BetterAuthUser = typeof import("./lib/auth").auth.$Infer.Session.user;
type BetterAuthSession = typeof import("./lib/auth").auth.$Infer.Session.session;

declare namespace App {
  interface Locals {
    user: BetterAuthUser | null;
    session: BetterAuthSession | null;
  }
}
