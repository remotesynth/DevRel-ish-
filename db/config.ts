import { column, defineDb, defineTable } from "astro:db";

// ── App Tables ────────────────────────────────────────────────────────────────

const Groups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text({ unique: true }),
    slug: column.text({ unique: true }),
    city: column.text(),
    region: column.text({ optional: true }), // state/province
    country: column.text(),
    description: column.text(),
    contactEmail: column.text(),
    status: column.text({ default: "pending" }), // pending | approved | rejected
    managerId: column.text({ optional: true, references: () => User.columns.id }),
    createdAt: column.date({ default: new Date() }),
  },
});

const Meetups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text({ references: () => Groups.columns.id }),
    title: column.text(),
    description: column.text(),
    date: column.date(),
    time: column.text(), // "HH:MM" 24-hour
    venue: column.text(), // venue name or address
    address: column.text({ optional: true }),
    capacity: column.number(),
    createdAt: column.date({ default: new Date() }),
  },
});

const RSVPs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    meetupId: column.text({ references: () => Meetups.columns.id }),
    name: column.text(),
    email: column.text(),
    jobTitle: column.text(),
    company: column.text(),
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
    userId: column.text({ references: () => User.columns.id }),
    // Admin plugin
    impersonatedBy: column.text({ optional: true }),
  },
});

const Account = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    accountId: column.text(),
    providerId: column.text(),
    userId: column.text({ references: () => User.columns.id }),
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
  tables: { Groups, Meetups, RSVPs, User, Session, Account, Verification },
});
