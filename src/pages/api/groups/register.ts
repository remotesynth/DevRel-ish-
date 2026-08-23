import type { APIRoute } from "astro";
import { db, Groups, AppUser } from "astro:db";
import { generateId, slugify } from "../../../lib/utils";
import { eq } from "astro:db";
import { CATEGORIES } from "../../../lib/categories";
import { getPdsSession, pdsCreate } from "../../../lib/atproto-pds";
import { buildAddress } from "../../../lib/atproto-records";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "You must be signed in to register a group." }, 401);
  }
  if (locals.user.groupId) {
    return json({ error: "You are already associated with a group." }, 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, tagline, category, city, region, country, description, contactEmail, _hp, _t } =
    body as Record<string, string>;

  // Bot protection
  const submittedAt = parseInt(_t ?? "0", 10);
  if (_hp || !submittedAt || Date.now() - submittedAt < 3000) {
    return json({ ok: true }, 201);
  }

  if (!name?.trim() || !description?.trim() || !contactEmail?.trim() || !category?.trim()) {
    return json({ error: "All required fields must be filled in." }, 400);
  }
  if (!CATEGORIES.find(c => c.slug === category.trim())) {
    return json({ error: "Please select a valid community category." }, 400);
  }
  if (description.trim().length < 50) {
    return json({ error: "Description must be at least 50 characters." }, 400);
  }
  if (!description.trim().includes(" ")) {
    return json({ error: "Please write a proper description for your group." }, 400);
  }

  const placeNameRe = /^[a-zA-ZÀ-ÿ\s\-'.,()]+$/;
  if (city?.trim() && !placeNameRe.test(city.trim())) {
    return json({ error: "Please enter a valid city name." }, 400);
  }
  if (region?.trim() && !placeNameRe.test(region.trim())) {
    return json({ error: "Please enter a valid state or region name." }, 400);
  }
  if (country?.trim() && !placeNameRe.test(country.trim())) {
    return json({ error: "Please enter a valid country name." }, 400);
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(contactEmail)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const [existing] = await db.select().from(Groups).where(eq(Groups.name, name.trim()));
  if (existing) {
    return json({ error: "A group with that name already exists." }, 409);
  }

  let slug = slugify(name);
  const [slugConflict] = await db.select().from(Groups).where(eq(Groups.slug, slug));
  if (slugConflict) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const session = await getPdsSession(locals.user.did);
  if (!session) {
    return json({ error: "Authentication session expired. Please sign in again." }, 401);
  }

  let atUri: string | null = null;
  let atCid: string | null = null;

  const now = new Date();
  const groupId = generateId();

  try {
    // `country` is the only required field of the address type, so an address
    // without one is invalid — buildAddress returns null and we omit the field.
    const address = buildAddress({
      locality: city as string | undefined,
      region: region as string | undefined,
      country: country as string | undefined,
    });
    const locationEntry = address ? { location: address } : {};

    const pdsResult = await pdsCreate(session, "com.devrelish.group", {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      ...locationEntry,
      createdAt: now.toISOString(),
    });
    atUri = pdsResult.uri;
    atCid = pdsResult.cid;
  } catch (err) {
    console.error("[groups/register] PDS write failed:", err);
    return json({ error: "Failed to publish group to ATProto network. Please try again." }, 500);
  }

  await db.insert(Groups).values({
    id: groupId,
    name: name.trim(),
    slug,
    tagline: tagline?.trim() || null,
    category: category.trim(),
    city: city?.trim() || null,
    region: region?.trim() || null,
    country: country?.trim() || null,
    description: description.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    status: "active",
    managerId: locals.user.did,
    atUri,
    atCid,
    createdAt: now,
  });

  await db.update(AppUser).set({ groupId }).where(eq(AppUser.did, locals.user.did));

  return json({ ok: true, slug }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
