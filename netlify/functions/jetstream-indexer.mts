import { createClient, type Client } from "@libsql/client";

// Runs every 5 minutes via Netlify Scheduled Functions
export const config = {
  schedule: "*/5 * * * *",
};

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const WANTED_COLLECTIONS = [
  "community.lexicon.calendar.event",
  "community.lexicon.calendar.rsvp",
  "com.devrelish.group",
  "com.devrelish.event.meta",
  "com.devrelish.membership",
];

// Stop collecting after this many ms — well within the 5-min interval
const MAX_COLLECT_MS = 45_000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitEvent {
  did: string;
  time_us: number;
  kind: "commit";
  commit: {
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
}

interface OtherEvent {
  did: string;
  time_us: number;
  kind: "identity" | "account";
}

type JetstreamEvent = CommitEvent | OtherEvent;

// ── Helpers ───────────────────────────────────────────────────────────────────

function atUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Index / delete per collection ─────────────────────────────────────────────

async function indexRecord(
  db: Client,
  uri: string,
  cid: string,
  did: string,
  collection: string,
  record: Record<string, unknown>,
  indexedAt: string
): Promise<void> {
  if (collection === "community.lexicon.calendar.event") {
    await db.execute({
      sql: `INSERT INTO "AtEvents" (uri, cid, did, name, startsAt, endsAt, description, locationJson, status, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :name, :startsAt, :endsAt, :description, :locationJson, :status, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, name = excluded.name, startsAt = excluded.startsAt,
              endsAt = excluded.endsAt, description = excluded.description,
              locationJson = excluded.locationJson, status = excluded.status,
              indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        name: String(record.name ?? ""),
        startsAt: String(record.startsAt ?? ""),
        endsAt: record.endsAt != null ? String(record.endsAt) : null,
        description: record.description != null ? String(record.description) : null,
        locationJson: record.locations != null ? JSON.stringify(record.locations) : null,
        status: record.status != null ? String(record.status) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return;
  }

  if (collection === "community.lexicon.calendar.rsvp") {
    const eventRef = record.event as { uri?: string } | undefined;
    await db.execute({
      sql: `INSERT INTO "AtRsvps" (uri, cid, did, eventUri, status, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :eventUri, :status, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, eventUri = excluded.eventUri,
              status = excluded.status, indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        eventUri: String(eventRef?.uri ?? ""),
        status: String(record.status ?? ""),
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return;
  }

  if (collection === "com.devrelish.group") {
    await db.execute({
      sql: `INSERT INTO "AtGroups" (uri, cid, did, name, description, locationJson, category, tags, website, blueskyHandle, linkedinUrl, coOrganizers, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :name, :description, :locationJson, :category, :tags, :website, :blueskyHandle, :linkedinUrl, :coOrganizers, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, name = excluded.name, description = excluded.description,
              locationJson = excluded.locationJson, category = excluded.category,
              tags = excluded.tags, website = excluded.website, blueskyHandle = excluded.blueskyHandle,
              linkedinUrl = excluded.linkedinUrl, coOrganizers = excluded.coOrganizers,
              indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        name: String(record.name ?? ""),
        description: String(record.description ?? ""),
        locationJson: record.location != null ? JSON.stringify(record.location) : null,
        category: record.category != null ? String(record.category) : null,
        tags: record.tags != null ? JSON.stringify(record.tags) : null,
        website: record.website != null ? String(record.website) : null,
        blueskyHandle: record.blueskyHandle != null ? String(record.blueskyHandle) : null,
        linkedinUrl: record.linkedinUrl != null ? String(record.linkedinUrl) : null,
        coOrganizers: record.coOrganizers != null ? JSON.stringify(record.coOrganizers) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return;
  }

  if (collection === "com.devrelish.event.meta") {
    const eventRef = record.event as { uri?: string } | undefined;
    const groupRef = record.group as { uri?: string } | undefined;
    await db.execute({
      sql: `INSERT INTO "AtEventMeta" (uri, cid, did, eventUri, groupUri, capacity, eventContext, speakersJson, sessionsJson, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :eventUri, :groupUri, :capacity, :eventContext, :speakersJson, :sessionsJson, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, eventUri = excluded.eventUri, groupUri = excluded.groupUri,
              capacity = excluded.capacity, eventContext = excluded.eventContext,
              speakersJson = excluded.speakersJson, sessionsJson = excluded.sessionsJson,
              indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        eventUri: String(eventRef?.uri ?? ""),
        groupUri: String(groupRef?.uri ?? ""),
        capacity: record.capacity != null ? Number(record.capacity) : null,
        eventContext: record.eventContext != null ? String(record.eventContext) : null,
        speakersJson: record.speakers != null ? JSON.stringify(record.speakers) : null,
        sessionsJson: record.sessions != null ? JSON.stringify(record.sessions) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return;
  }

  if (collection === "com.devrelish.membership") {
    const groupRef = record.group as { uri?: string } | undefined;
    await db.execute({
      sql: `INSERT INTO "AtMemberships" (uri, cid, did, groupUri, role, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :groupUri, :role, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, groupUri = excluded.groupUri,
              role = excluded.role, indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        groupUri: String(groupRef?.uri ?? ""),
        role: record.role != null ? String(record.role) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
  }
}

async function deleteRecord(
  db: Client,
  uri: string,
  collection: string
): Promise<void> {
  const tableMap: Record<string, string> = {
    "community.lexicon.calendar.event": "AtEvents",
    "community.lexicon.calendar.rsvp": "AtRsvps",
    "com.devrelish.group": "AtGroups",
    "com.devrelish.event.meta": "AtEventMeta",
    "com.devrelish.membership": "AtMemberships",
  };
  const table = tableMap[collection];
  if (!table) return;
  await db.execute({
    sql: `DELETE FROM "${table}" WHERE uri = ?`,
    args: [uri],
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(): Promise<void> {
  const dbUrl = process.env.ASTRO_DB_REMOTE_URL;
  const dbToken = process.env.ASTRO_DB_APP_TOKEN;

  if (!dbUrl || !dbToken) {
    console.error("[jetstream-indexer] Missing ASTRO_DB_REMOTE_URL or ASTRO_DB_APP_TOKEN");
    return;
  }

  const db = createClient({ url: dbUrl, authToken: dbToken });

  // Load last cursor
  const cursorResult = await db.execute(
    `SELECT cursor FROM "JetstreamCursor" WHERE id = 'default'`
  );
  const cursor = cursorResult.rows[0]?.[0] as string | undefined;

  // Build subscription URL
  const params = new URLSearchParams();
  for (const col of WANTED_COLLECTIONS) {
    params.append("wantedCollections[]", col);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }

  const wsUrl = `${JETSTREAM_URL}?${params}`;
  console.log(`[jetstream-indexer] Connecting, cursor=${cursor ?? "none"}`);

  // Phase 1: collect events until caught up or timeout
  const events: JetstreamEvent[] = [];
  let latestCursor = cursor ?? null;

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl);

    const deadline = setTimeout(() => {
      console.log("[jetstream-indexer] Collection timeout reached, closing");
      ws.close();
    }, MAX_COLLECT_MS);

    ws.addEventListener("message", (event) => {
      let msg: JetstreamEvent;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      events.push(msg);
      if (msg.time_us) {
        latestCursor = String(msg.time_us);
        // Caught up: latest event is within 10 s of now
        if (msg.time_us / 1_000 > Date.now() - 10_000) {
          clearTimeout(deadline);
          ws.close();
        }
      }
    });

    ws.addEventListener("close", () => {
      clearTimeout(deadline);
      resolve();
    });

    ws.addEventListener("error", (err) => {
      console.error("[jetstream-indexer] WS error:", err);
      clearTimeout(deadline);
      resolve();
    });
  });

  console.log(`[jetstream-indexer] Collected ${events.length} events`);

  // Phase 2: process events sequentially
  const indexedAt = nowIso();
  let indexed = 0;
  let deleted = 0;

  for (const msg of events) {
    if (msg.kind !== "commit") continue;
    const { did, commit } = msg as CommitEvent;
    const { operation, collection, rkey, record, cid } = commit;
    const uri = atUri(did, collection, rkey);

    try {
      if ((operation === "create" || operation === "update") && record && cid) {
        await indexRecord(db, uri, cid, did, collection, record, indexedAt);
        indexed++;
      } else if (operation === "delete") {
        await deleteRecord(db, uri, collection);
        deleted++;
      }
    } catch (err) {
      console.error(`[jetstream-indexer] Failed on ${uri}:`, err);
    }
  }

  // Phase 3: persist cursor
  if (latestCursor) {
    await db.execute({
      sql: `INSERT INTO "JetstreamCursor" (id, cursor, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET cursor = excluded.cursor, updatedAt = excluded.updatedAt`,
      args: ["default", latestCursor, nowIso()],
    });
  }

  console.log(
    `[jetstream-indexer] Done — indexed=${indexed} deleted=${deleted} cursor=${latestCursor}`
  );
}
