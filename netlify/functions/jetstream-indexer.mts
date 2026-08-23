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

// How far back a first run replays. Jetstream keeps a rolling window; asking for
// more than it holds simply starts at the oldest it has.
const COLD_START_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// Per-run cap on repo back-catalogue fetches, so a busy sweep can't blow the
// function's time budget.
const MAX_BACKFILL_REPOS = 8;

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
): Promise<boolean> {
  if (!WANTED_COLLECTIONS.includes(collection)) return false;

  if (collection === "community.lexicon.calendar.event") {
    await db.execute({
      sql: `INSERT INTO "AtEvents" (uri, cid, did, name, startsAt, endsAt, description, locationJson, urisJson, mode, status, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :name, :startsAt, :endsAt, :description, :locationJson, :urisJson, :mode, :status, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, name = excluded.name, startsAt = excluded.startsAt,
              endsAt = excluded.endsAt, description = excluded.description,
              locationJson = excluded.locationJson, urisJson = excluded.urisJson,
              mode = excluded.mode, status = excluded.status,
              indexedAt = excluded.indexedAt`,
      args: {
        uri, cid, did,
        name: String(record.name ?? ""),
        startsAt: String(record.startsAt ?? ""),
        endsAt: record.endsAt != null ? String(record.endsAt) : null,
        description: record.description != null ? String(record.description) : null,
        locationJson: record.locations != null ? JSON.stringify(record.locations) : null,
        urisJson: record.uris != null ? JSON.stringify(record.uris) : null,
        mode: record.mode != null ? String(record.mode) : null,
        status: record.status != null ? String(record.status) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return true;
  }

  if (collection === "community.lexicon.calendar.rsvp") {
    // community lexicon uses "subject"; tolerate legacy "event" field from earlier DevRel(ish) writes
    const eventRef = (record.subject ?? record.event) as { uri?: string } | undefined;
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
    return true;
  }

  if (collection === "com.devrelish.group") {
    await db.execute({
      sql: `INSERT INTO "AtGroups" (uri, cid, did, name, description, locationJson, category, tags, website, handle, handleDid, linkedinUrl, coOrganizers, createdAt, indexedAt)
            VALUES (:uri, :cid, :did, :name, :description, :locationJson, :category, :tags, :website, :handle, :handleDid, :linkedinUrl, :coOrganizers, :createdAt, :indexedAt)
            ON CONFLICT (uri) DO UPDATE SET
              cid = excluded.cid, name = excluded.name, description = excluded.description,
              locationJson = excluded.locationJson, category = excluded.category,
              tags = excluded.tags, website = excluded.website, handle = excluded.handle, handleDid = excluded.handleDid,
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
        handle: record.handle != null ? String(record.handle) : null,
        handleDid: record.did != null ? String(record.did) : null,
        linkedinUrl: record.linkedinUrl != null ? String(record.linkedinUrl) : null,
        coOrganizers: record.coOrganizers != null ? JSON.stringify(record.coOrganizers) : null,
        createdAt: String(record.createdAt ?? indexedAt),
        indexedAt,
      },
    });
    return true;
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
    return true;
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
    return true;
  }

  return false;
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

// ── Repo back-catalogue ───────────────────────────────────────────────────────
//
// Jetstream is forward-only: it tells us about records as they're written, so an
// event created last month is invisible no matter how long we listen. When we
// first see a DID publishing calendar events we therefore read its whole
// collection straight from its PDS. Unauthenticated, public reads.
//
// This compounds: every new organizer the firehose reveals brings their back
// catalogue with them.

async function resolvePds(did: string): Promise<string | null> {
  const url = did.startsWith("did:plc:")
    ? `https://plc.directory/${did}`
    : did.startsWith("did:web:")
      ? `https://${did.slice("did:web:".length).replaceAll(":", "/")}/.well-known/did.json`
      : null;
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const doc = (await res.json()) as { service?: Array<{ id?: string; serviceEndpoint?: string }> };
    const pds = doc.service?.find((sv) => String(sv.id).endsWith("#atproto_pds"))?.serviceEndpoint;
    return typeof pds === "string" ? pds.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

async function backfillRepo(db: Client, did: string, collection: string, indexedAt: string): Promise<number> {
  const pds = await resolvePds(did);
  if (!pds) return 0;

  let cursor: string | undefined;
  let n = 0;

  try {
    // Two pages is plenty for a meetup organizer's history and keeps the
    // per-run cost predictable.
    for (let page = 0; page < 2; page++) {
      const qs = new URLSearchParams({ repo: did, collection, limit: "100" });
      if (cursor) qs.set("cursor", cursor);

      const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${qs}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) break;

      const body = (await res.json()) as {
        records?: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
        cursor?: string;
      };
      const batch = body.records ?? [];
      for (const rec of batch) {
        try {
          await indexRecord(db, rec.uri, rec.cid, did, collection, rec.value, indexedAt);
          n++;
        } catch (err) {
          console.warn("[jetstream-indexer] backfill index failed", rec.uri, err);
        }
      }
      if (!body.cursor || batch.length === 0) break;
      cursor = body.cursor;
    }
  } catch (err) {
    console.warn("[jetstream-indexer] backfill failed for", did, err);
  }

  return n;
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

  // Load last cursor.
  //
  // On a cold start there isn't one, and connecting with no cursor makes
  // Jetstream stream from *now* — so a freshly deployed site sees an empty
  // network until somebody, somewhere, happens to publish. Jetstream accepts a
  // past cursor and replays from it, so the first run reaches back through its
  // retention window instead. That's the difference between the network rail
  // being populated at launch and being empty for a day.
  const cursorResult = await db.execute(
    `SELECT cursor FROM "JetstreamCursor" WHERE id = 'default'`
  );
  const stored = cursorResult.rows[0]?.[0] as string | undefined;
  const coldStart = !stored;
  const cursor =
    stored ?? String((Date.now() - COLD_START_LOOKBACK_MS) * 1_000);

  // Build subscription URL
  const params = new URLSearchParams();
  for (const col of WANTED_COLLECTIONS) {
    // No brackets. `wantedCollections[]` is silently ignored by Jetstream, which
    // then streams the ENTIRE firehose — measured at ~2,000 events per 6s, of
    // which essentially none are calendar records. The bracketed spelling meant
    // this function was pulling the whole network every 5 minutes and throwing
    // 99.9% of it away.
    params.append("wantedCollections", col);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }

  const wsUrl = `${JETSTREAM_URL}?${params}`;
  console.log(
    `[jetstream-indexer] Connecting, cursor=${cursor}${coldStart ? " (cold start — replaying backlog)" : ""}`
  );

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
  let skipped = 0;

  // DIDs seen publishing calendar events this sweep — candidates for a
  // back-catalogue read once the live pass is done.
  const eventAuthors = new Set<string>();

  for (const msg of events) {
    if (msg.kind !== "commit") continue;
    const { did, commit } = msg as CommitEvent;
    const { operation, collection, rkey, record, cid } = commit;
    const uri = atUri(did, collection, rkey);

    if (collection === "community.lexicon.calendar.event" && operation !== "delete") {
      eventAuthors.add(did);
    }

    try {
      if ((operation === "create" || operation === "update") && record && cid) {
        if (await indexRecord(db, uri, cid, did, collection, record, indexedAt)) indexed++;
        else skipped++;
      } else if (operation === "delete") {
        await deleteRecord(db, uri, collection);
        deleted++;
      }
    } catch (err) {
      console.error(`[jetstream-indexer] Failed on ${uri}:`, err);
    }
  }

  // Phase 3: back-catalogue. Read the full calendar collection of authors we
  // haven't seen before, so their existing events show up rather than only
  // whatever they post from now on.
  let backfilled = 0;
  const fresh: string[] = [];
  for (const did of eventAuthors) {
    const seen = await db.execute({
      sql: `SELECT 1 FROM "BackfilledRepos" WHERE did = ? LIMIT 1`,
      args: [did],
    });
    if (seen.rows.length === 0) fresh.push(did);
    if (fresh.length >= MAX_BACKFILL_REPOS) break;
  }

  for (const did of fresh) {
    const n = await backfillRepo(db, did, "community.lexicon.calendar.event", indexedAt);
    backfilled += n;
    await db.execute({
      sql: `INSERT INTO "BackfilledRepos" (did, records, backfilledAt) VALUES (?, ?, ?)
            ON CONFLICT (did) DO UPDATE SET records = excluded.records, backfilledAt = excluded.backfilledAt`,
      args: [did, n, indexedAt],
    });
  }
  if (fresh.length) {
    console.log(`[jetstream-indexer] Backfilled ${backfilled} records from ${fresh.length} new repo(s)`);
  }

  // Phase 4: persist cursor
  if (latestCursor) {
    await db.execute({
      sql: `INSERT INTO "JetstreamCursor" (id, cursor, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET cursor = excluded.cursor, updatedAt = excluded.updatedAt`,
      args: ["default", latestCursor, nowIso()],
    });
  }

  console.log(
    `[jetstream-indexer] Done — indexed=${indexed} backfilled=${backfilled} ` +
      `deleted=${deleted} skipped=${skipped} cursor=${latestCursor}`
  );
}
