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
    blueskyHandle: column.text({ optional: true }),
    linkedinUrl: column.text({ optional: true }),
    description: column.text(),
    contactEmail: column.text(),
    status: column.text({ default: "active" }), // active | closed
    managerId: column.text({ optional: true }), // soft ref to AppUser.did
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
    venue: column.text(),
    address: column.text({ optional: true }),
    city: column.text({ optional: true }),
    country: column.text({ optional: true }),
    eventContext: column.text({ optional: true }),
    tags: column.text({ optional: true }),
    capacity: column.number(),
    status: column.text({ default: "active" }), // active | canceled
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
    status: column.text({ optional: true }),
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
    blueskyHandle: column.text({ optional: true }),
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
