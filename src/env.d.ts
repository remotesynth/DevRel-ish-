/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_URL: string;
  readonly ADMIN_DIDS: string;
  readonly CONDUCT_EMAIL: string;
  readonly ATPROTO_PRIVATE_KEY_JWK: string;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
}

// Shape of locals.user — mirrors AppUser columns plus a convenience id alias
interface AppUser {
  id: string;          // alias for did — keeps existing route code unchanged
  did: string;
  handle: string;
  displayName: string | null;
  role: string;        // "admin" | "user"
  groupId: string | null;
}

declare namespace App {
  interface Locals {
    user: AppUser | null;
  }
}
