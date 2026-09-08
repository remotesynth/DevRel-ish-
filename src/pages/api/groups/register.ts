import type { APIRoute } from "astro";
import { db, Groups, AppUser } from "astro:db";
import { generateId, slugify } from "../../../lib/utils";
import { eq } from "astro:db";
import { CATEGORIES } from "../../../lib/categories";
import { normalizeTimeZone } from "../../../lib/timezone";

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

  const { name, tagline, category, city, region, country, timezone: timezoneInput, description, contactEmail, _hp, _t } =
    body as Record<string, string>;
  const conduct = (body as Record<string, unknown>).conduct;

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
  // Same gate as the form. Without this the commitment is bypassable by
  // anything that can POST JSON, and the admin's close-group action loses
  // the basis it depends on.
  if (conduct !== true && conduct !== "on") {
    return json({ error: "You must agree to the code of conduct to register a group." }, 400);
  }
  if (!emailRe.test(contactEmail)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }
  const timezone = normalizeTimeZone(timezoneInput);
  if (!timezone) return json({ error: "Use a valid IANA timezone such as America/New_York or Europe/London." }, 400);

  const [existing] = await db.select().from(Groups).where(eq(Groups.name, name.trim()));
  if (existing) {
    return json({ error: "A group with that name already exists." }, 409);
  }

  let slug = slugify(name);
  const [slugConflict] = await db.select().from(Groups).where(eq(Groups.slug, slug));
  if (slugConflict) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const now = new Date();
  const groupId = generateId();

  await db.insert(Groups).values({
    id: groupId,
    name: name.trim(),
    slug,
    tagline: tagline?.trim() || null,
    category: category.trim(),
    city: city?.trim() || null,
    region: region?.trim() || null,
    country: country?.trim() || null,
    timezone,
    description: description.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    status: "active",
    conductAgreedAt: now,
    managerId: locals.user.did,
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
