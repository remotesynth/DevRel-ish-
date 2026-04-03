import type { APIRoute } from "astro";
import { db, Groups, Meetups, eq, and, gte, asc } from "astro:db";
import { stripMarkdown } from "../../../lib/markdown";

export const GET: APIRoute = async ({ params, url }) => {
  const { slug } = params;
  if (!slug) return new Response("Not found", { status: 404 });

  const [group] = await db.select().from(Groups).where(eq(Groups.slug, slug));
  if (!group || group.status !== "approved") {
    return new Response("Not found", { status: 404 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const meetups = await db
    .select()
    .from(Meetups)
    .where(and(eq(Meetups.groupId, group.id), gte(Meetups.date, today)))
    .orderBy(asc(Meetups.date))
    .limit(20);

  const origin = url.origin;
  const groupUrl = `${origin}/groups/${slug}`;

  function escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  const items = meetups.map(m => {
    const dateStr = m.date.toUTCString();
    const rsvpUrl = `${origin}/gatherings/${m.id}/rsvp`;
    const locationParts = [m.city, m.country].filter(Boolean).join(", ");
    const where = m.eventContext
      ? locationParts ? `${m.eventContext} · ${locationParts}` : m.eventContext
      : locationParts || m.venue;
    const plain = stripMarkdown(m.description);
    const summary = [where && `Where: ${where}`, plain].filter(Boolean).join("\n\n");

    return `
    <item>
      <title>${escapeXml(m.title)}</title>
      <link>${escapeXml(rsvpUrl)}</link>
      <guid isPermaLink="true">${escapeXml(rsvpUrl)}</guid>
      <pubDate>${dateStr}</pubDate>
      <description>${escapeXml(summary)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(group.name)} — DevRel(ish)</title>
    <link>${escapeXml(groupUrl)}</link>
    <description>${escapeXml(group.tagline ?? stripMarkdown(group.description).slice(0, 200))}</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${origin}/groups/${slug}/rss.xml`)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
