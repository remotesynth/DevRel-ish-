import { column, defineDb, defineTable } from "astro:db";

// ── App Tables ────────────────────────────────────────────────────────────────

const Groups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text({ unique: true }),
    slug: column.text({ unique: true }),
    customSlug: column.text({ optional: true, unique: true }),
    city: column.text({ optional: true }),
    region: column.text({ optional: true }),
    country: column.text({ optional: true }),
    tagline: column.text({ optional: true }),
    tags: column.text({ optional: true }),
    category: column.text({ optional: true }),
    website: column.text({ optional: true }),
    handle: column.text({ optional: true }),      // the group's own ATProto handle, no @
    handleDid: column.text({ optional: true }),   // DID that handle resolved to, if verified
    linkedinUrl: column.text({ optional: true }),
    description: column.text(),
    contactEmail: column.text(),
    status: column.text({ default: "active" }), // active | closed
    managerId: column.text({ optional: true }), // soft ref to AppUser.did
    atUri: column.text({ optional: true }),     // at:// URI of com.devrelish.group
    atCid: column.text({ optional: true }),     // CID of the group record
    createdAt: column.date({ default: new Date() }),
  },
});

const Meetups = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(),
    title: column.text(),
    description: column.text(),
    date: column.date(),
    time: column.text(),
    endTime: column.text({ optional: true }),  // "HH:MM", local to the venue
    venue: column.text(),
    address: column.text({ optional: true }),
    city: column.text({ optional: true }),
    country: column.text({ optional: true }),
    eventContext: column.text({ optional: true }),
    tags: column.text({ optional: true }),
    capacity: column.number(),
    status: column.text({ default: "active" }), // active | canceled
    atEventUri: column.text({ optional: true }), // at:// URI of community.lexicon.calendar.event
    atEventCid: column.text({ optional: true }), // CID of the event record
    atMetaUri: column.text({ optional: true }),  // at:// URI of com.devrelish.event.meta
    atMetaCid: column.text({ optional: true }),  // CID of the meta record
    adopted: column.boolean({ default: false }), // event record came from another app; we don't own it
    createdAt: column.date({ default: new Date() }),
  },
});

const RSVPs = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    meetupId: column.text(),
    name: column.text(),
    email: column.text(),
    jobTitle: column.text(),
    company: column.text(),
    cancelToken: column.text({ optional: true, unique: true }),
    createdAt: column.date({ default: new Date() }),
  },
});

const GroupInvites = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(),
    createdAt: column.date(),
    expiresAt: column.date(),
  },
});

const ContactMessages = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(),
    name: column.text(),
    email: column.text(),
    message: column.text(),
    read: column.boolean({ default: false }),
    createdAt: column.date({ default: new Date() }),
  },
});

const GatheringSpeakers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    gatheringId: column.text(),
    speakerName: column.text(),
    speakerJobTitle: column.text({ optional: true }),
    speakerCompany: column.text({ optional: true }),
    speakerImageUrl: column.text({ optional: true }),
    speakerBio: column.text({ optional: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: new Date() }),
  },
});

const GatheringSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    gatheringId: column.text(),
    title: column.text(),
    abstract: column.text({ optional: true }),
    startTime: column.text({ optional: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: new Date() }),
  },
});

const GatheringSessionSpeakers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text(),
    speakerId: column.text(),
    sortOrder: column.number({ default: 0 }),
  },
});

const Followers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    groupId: column.text(),
    email: column.text(),
    name: column.text({ optional: true }),
    confirmed: column.boolean({ default: false }),
    token: column.text({ unique: true }),
    createdAt: column.date({ default: new Date() }),
  },
});

// ── ATProto AppView Index Tables ─────────────────────────────────────────────

// Persists the Jetstream cursor across scheduled function runs
const JetstreamCursor = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),   // always "default"
    cursor: column.text(),                   // microseconds timestamp as string
    updatedAt: column.date({ default: new Date() }),
  },
});

// Indexed community.lexicon.calendar.event records
const AtEvents = defineTable({
  columns: {
    uri: column.text({ primaryKey: true }), // at://did/collection/rkey
    cid: column.text(),
    did: column.text(),                     // creator DID
    name: column.text(),
    startsAt: column.text(),                // ISO datetime string
    endsAt: column.text({ optional: true }),
    description: column.text({ optional: true }),
    locationJson: column.text({ optional: true }), // JSON-serialized locations array
    urisJson: column.text({ optional: true }),     // JSON-serialized uris array — how we link back to the source app
    mode: column.text({ optional: true }),         // #inperson | #virtual | #hybrid
    status: column.text({ optional: true }),       // #scheduled | #cancelled | ...
    createdAt: column.text(),
    indexedAt: column.text(),
  },
});

// Indexed community.lexicon.calendar.rsvp records
const AtRsvps = defineTable({
  columns: {
    uri: column.text({ primaryKey: true }),
    cid: column.text(),
    did: column.text(),                     // responder DID
    eventUri: column.text(),                // at:// URI of the event
    status: column.text(),                  // yes | no | maybe
    createdAt: column.text(),
    indexedAt: column.text(),
  },
});

// Indexed com.devrelish.group records
const AtGroups = defineTable({
  columns: {
    uri: column.text({ primaryKey: true }),
    cid: column.text(),
    did: column.text(),                     // organizer DID
    name: column.text(),
    description: column.text(),
    locationJson: column.text({ optional: true }),
    category: column.text({ optional: true }),
    tags: column.text({ optional: true }),  // JSON array
    website: column.text({ optional: true }),
    handle: column.text({ optional: true }),      // the group's own ATProto handle, no @
    handleDid: column.text({ optional: true }),   // DID that handle resolved to, if verified
    linkedinUrl: column.text({ optional: true }),
    coOrganizers: column.text({ optional: true }), // JSON array of DIDs
    createdAt: column.text(),
    indexedAt: column.text(),
  },
});

// Indexed com.devrelish.event.meta records
const AtEventMeta = defineTable({
  columns: {
    uri: column.text({ primaryKey: true }),
    cid: column.text(),
    did: column.text(),
    eventUri: column.text(),                // at:// URI of the calendar event
    groupUri: column.text(),                // at:// URI of the group
    capacity: column.number({ optional: true }),
    eventContext: column.text({ optional: true }),
    speakersJson: column.text({ optional: true }), // JSON array
    sessionsJson: column.text({ optional: true }), // JSON array
    createdAt: column.text(),
    indexedAt: column.text(),
  },
});

// Indexed com.devrelish.membership records
const AtMemberships = defineTable({
  columns: {
    uri: column.text({ primaryKey: true }),
    cid: column.text(),
    did: column.text(),                     // member DID
    groupUri: column.text(),                // at:// URI of the group
    role: column.text({ optional: true }),
    createdAt: column.text(),
    indexedAt: column.text(),
  },
});

// ── Deprecated better-auth Tables (dropped in ATProto migration) ─────────────
// Keep these deprecated stubs so AstroDB doesn't mistake the User→AppUser
// column overlap for a table rename. Safe to remove after first successful deploy.

const User = defineTable({
  deprecated: true,
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    email: column.text({ unique: true }),
    emailVerified: column.boolean({ default: false }),
    image: column.text({ optional: true }),
    createdAt: column.date(),
    updatedAt: column.date(),
    role: column.text({ optional: true }),
    banned: column.boolean({ optional: true }),
    banReason: column.text({ optional: true }),
    banExpires: column.date({ optional: true }),
    groupId: column.text({ optional: true }),
  },
});

const Session = defineTable({
  deprecated: true,
  columns: {
    id: column.text({ primaryKey: true }),
    expiresAt: column.date(),
    token: column.text({ unique: true }),
    createdAt: column.date(),
    updatedAt: column.date(),
    ipAddress: column.text({ optional: true }),
    userAgent: column.text({ optional: true }),
    userId: column.text(),
    impersonatedBy: column.text({ optional: true }),
  },
});

const Account = defineTable({
  deprecated: true,
  columns: {
    id: column.text({ primaryKey: true }),
    accountId: column.text(),
    providerId: column.text(),
    userId: column.text(),
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
  deprecated: true,
  columns: {
    id: column.text({ primaryKey: true }),
    identifier: column.text(),
    value: column.text(),
    expiresAt: column.date(),
    createdAt: column.date({ optional: true }),
    updatedAt: column.date({ optional: true }),
  },
});

// ── ATProto Auth Tables ───────────────────────────────────────────────────────

// Organizer/admin accounts — keyed by ATProto DID
const AppUser = defineTable({
  columns: {
    did: column.text({ primaryKey: true }),
    handle: column.text(),
    displayName: column.text({ optional: true }),
    role: column.text({ default: "user" }),   // "admin" | "user"
    groupId: column.text({ optional: true }), // soft ref to Groups.id
    createdAt: column.date({ default: new Date() }),
  },
});

// Browser sessions — cookie value maps to a DID
const AppSession = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),    // random value stored in cookie
    did: column.text(),                       // soft ref to AppUser.did
    expiresAt: column.date(),
    createdAt: column.date({ default: new Date() }),
  },
});

// ATProto OAuth state — ephemeral, 10-min TTL, keyed by state nonce
const OAuthState = defineTable({
  columns: {
    key: column.text({ primaryKey: true }),
    value: column.text(),                     // JSON-serialized NodeSavedState
    expiresAt: column.date(),
  },
});

// ATProto OAuth session — persistent, keyed by DID (sub)
const OAuthSession = defineTable({
  columns: {
    did: column.text({ primaryKey: true }),
    value: column.text(),                     // JSON-serialized NodeSavedSession
  },
});

export default defineDb({
  tables: {
    Groups,
    Meetups,
    RSVPs,
    GatheringSpeakers,
    GatheringSessions,
    GatheringSessionSpeakers,
    GroupInvites,
    ContactMessages,
    Followers,
    // Deprecated better-auth tables — remove after first successful deploy
    User,
    Session,
    Account,
    Verification,
    // ATProto tables
    AppUser,
    AppSession,
    OAuthState,
    OAuthSession,
    JetstreamCursor,
    AtEvents,
    AtRsvps,
    AtGroups,
    AtEventMeta,
    AtMemberships,
  },
});
