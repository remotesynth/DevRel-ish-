/**
 * Re-run the topical classifier over already-indexed events.
 *
 * The verdict is stored at index time, so changing the vocabulary in
 * src/lib/topical.ts doesn't retroactively fix rows already in the table.
 * Run this after editing the term lists.
 *
 * Dry run (default) prints what would change without writing:
 *   ASTRO_DB_REMOTE_URL=... ASTRO_DB_APP_TOKEN=... node scripts/reclassify-events.mjs
 * Apply:
 *   ... node scripts/reclassify-events.mjs --apply
 */
import { createClient } from "@libsql/client";
import { classifyEvent } from "../src/lib/topical.ts";

const apply = process.argv.includes("--apply");
const url = process.env.ASTRO_DB_REMOTE_URL;
const authToken = process.env.ASTRO_DB_APP_TOKEN;
if (!url) {
  console.error("Set ASTRO_DB_REMOTE_URL (a file: URL works for a local db).");
  process.exit(1);
}

const db = createClient(url.startsWith("file:") ? { url } : { url, authToken });

const rows = (
  await db.execute(`SELECT uri, name, description, topical FROM "AtEvents"`)
).rows;

const claimedRows = await db.execute(`SELECT eventUri FROM "AtEventMeta"`);
const claimed = new Set(claimedRows.rows.map((r) => String(r.eventUri)));

let changed = 0;
let nowTopical = 0;
let nowNot = 0;

for (const r of rows) {
  const before = Number(r.topical) === 1;
  const v = classifyEvent(r.name, r.description, claimed.has(String(r.uri)));
  if (v.topical === before) continue;

  changed++;
  v.topical ? nowTopical++ : nowNot++;
  console.log(
    `${v.topical ? "+" : "-"} [${String(v.score).padStart(3)}] ${String(r.name ?? "").slice(0, 58)}` +
      (v.terms.length ? `  (${v.terms.slice(0, 3).join(", ")})` : "")
  );

  if (apply) {
    await db.execute({
      sql: `UPDATE "AtEvents" SET topical = ?, topicalScore = ?, topicalTerms = ? WHERE uri = ?`,
      args: [v.topical ? 1 : 0, v.score, v.terms.join(", ") || null, String(r.uri)],
    });
  }
}

console.log(
  `\n${rows.length} indexed · ${changed} would change (+${nowTopical} topical, -${nowNot})` +
    (apply ? " — applied" : " — dry run, pass --apply to write")
);
