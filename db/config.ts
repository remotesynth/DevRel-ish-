import { column, defineDb, defineTable } from "astro:db";

// ── App Tables ────────────────────────────────────────────────────────────────

const Groups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text({ unique: true }),
    slug: column.text({ unique: true }),
    // Location is optional — groups may be distributed/event-based
    city: column.text({ optional: true }),
    region: column.text({ optional: true }), // state/province
    country: column.text({ optional: true }),
    // Identity & discovery
    tagline: column.text({ optional: true }), // short one-liner for cards
    tags: column.text({ optional: true }), // comma-separated
    website: column.text({ optional: true }),
    twitterHandle: column.text({ optional: true }),
    blueskyHandle: column.text({ optional: true }),
    linkedinUrl: column.text({ optional: true }),
    // Core
    description: column.text(),
    contactEmail: column.text(),
    status: column.text({ default: "pending" }), // pending | approved | rejected | closed
    managerId: column.text({ optional: true }), // soft ref to User.id
    createdAt: column.date({ default: new Date() }),
  },
});

const Meetups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(), // soft ref to Groups.id
    title: column.text(),
    description: column.text(),
    date: column.date(),
    time: column.text(), // "HH:MM" 24-hour
    venue: column.text(), // venue name or address
    address: column.text({ optional: true }),
    // Location context for event-based gatherings
    city: column.text({ optional: true }),
    country: column.text({ optional: true }),
    eventContext: column.text({ optional: true }), // e.g. "KubeCon EU 2026"
    tags: column.text({ optional: true }), // comma-separated
    capacity: column.number(),
    status: column.text({ default: "active" }), // active | canceled
    createdAt: column.date({ default: new Date() }),
  },
});

const RSVPs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    meetupId: column.text(), // soft ref to Meetups.id
    name: column.text(),
    email: column.text(),
    jobTitle: column.text(),
    company: column.text(),
    createdAt: column.date({ default: new Date() }),
  },
});

const GroupInvites = defineTable({
  columns: {
    id: column.text({ primaryKey: true }), // the invite token used in the URL
    groupId: column.text(), // soft ref to Groups.id
    createdAt: column.date(),
    expiresAt: column.date(),
  },
});

const ContactMessages = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(), // soft ref to Groups.id
    name: column.text(),
    email: column.text(),
    message: column.text(),
    read: column.boolean({ default: false }),
    createdAt: column.date({ default: new Date() }),
  },
});

const Followers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(), // soft ref to Groups.id
    email: column.text(),
    name: column.text({ optional: true }),
    confirmed: column.boolean({ default: false }),
    token: column.text({ unique: true }), // for confirm + unsubscribe links
    createdAt: column.date({ default: new Date() }),
  },
});

// ── better-auth Tables ────────────────────────────────────────────────────────

const User = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    email: column.text({ unique: true }),
    emailVerified: column.boolean({ default: false }),
    image: column.text({ optional: true }),
    createdAt: column.date(),
    updatedAt: column.date(),
    // Admin plugin
    role: column.text({ optional: true }),
    banned: column.boolean({ optional: true }),
    banReason: column.text({ optional: true }),
    banExpires: column.date({ optional: true }),
    // App-specific: link manager to their group
    groupId: column.text({ optional: true }),
  },
});

const Session = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    expiresAt: column.date(),
    token: column.text({ unique: true }),
    createdAt: column.date(),
    updatedAt: column.date(),
    ipAddress: column.text({ optional: true }),
    userAgent: column.text({ optional: true }),
    userId: column.text(), // soft ref to User.id
    // Admin plugin
    impersonatedBy: column.text({ optional: true }),
  },
});

const Account = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    accountId: column.text(),
    providerId: column.text(),
    userId: column.text(), // soft ref to User.id
    accessToken: column.text({ optional: true }),
    refreshToken: column.text({ optional: true }),
    idToken: column.text({ optional: true }),
    accessTokenExpiresAt: column.date({ optional: true }),
    refreshTokenExpiresAt: column.date({ optional: true }),
    scope: column.text({ optional: true }),
    password: column.text({ optional: true }),
    createdAt: column.date(),
    updatedAt: column.date(),
  },
});

const Verification = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    identifier: column.text(),
    value: column.text(),
    expiresAt: column.date(),
    createdAt: column.date({ optional: true }),
    updatedAt: column.date({ optional: true }),
  },
});

export default defineDb({
  tables: { Groups, Meetups, RSVPs, GroupInvites, ContactMessages, Followers, User, Session, Account, Verification },
});
