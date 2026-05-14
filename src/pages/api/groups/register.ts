import type { APIRoute } from "astro";
import { db, Groups } from "astro:db";
import { generateId, slugify } from "../../../lib/utils";
import { eq } from "astro:db";
import { CATEGORIES } from "../../../lib/categories";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, category, city, region, country, description, contactEmail, _hp, _t } = body as Record<string, string>;

  // Bot protection: honeypot must be empty; form must have been open ≥3 seconds
  const submittedAt = parseInt(_t ?? "0", 10);
  if (_hp || !submittedAt || Date.now() - submittedAt < 3000) {
    return json({ ok: true }, 201); // Silently fake success
  }

  // Basic validation
  if (!name?.trim() || !description?.trim() || !contactEmail?.trim() || !category?.trim()) {
    return json({ error: "All required fields must be filled in." }, 400);
  }

  if (!CATEGORIES.find(c => c.slug === category.trim())) {
    return json({ error: "Please select a valid community category." }, 400);
  }

  if (description.trim().length < 50) {
    return json({ error: "Description must be at least 50 characters." }, 400);
  }

  // Real descriptions always have spaces; single-block random strings do not
  if (!description.trim().includes(" ")) {
    return json({ error: "Please write a proper description for your group." }, 400);
  }

  // Real place names contain only letters, spaces, hyphens, apostrophes — never digits
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

  // Validate email format
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(contactEmail)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  // Check for duplicate name
  const [existing] = await db.select().from(Groups).where(eq(Groups.name, name.trim()));
  if (existing) {
    return json({ error: "A group with that name already exists." }, 409);
  }

  // Generate unique slug
  let slug = slugify(name);
  const [slugConflict] = await db.select().from(Groups).where(eq(Groups.slug, slug));
  if (slugConflict) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  await db.insert(Groups).values({
    id: generateId(),
    name: name.trim(),
    slug,
    category: category.trim(),
    city: city?.trim() || null,
    region: region?.trim() || null,
    country: country?.trim() || null,
    description: description.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    status: "pending",
    createdAt: new Date(),
  });

  return json({ ok: true }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
