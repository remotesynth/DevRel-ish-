import type { APIRoute } from "astro";
import { db, Groups } from "astro:db";
import { generateId, slugify } from "../../../lib/utils";
import { eq } from "astro:db";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, city, region, country, description, contactEmail } = body as Record<string, string>;

  // Basic validation
  if (!name?.trim() || !city?.trim() || !country?.trim() || !description?.trim() || !contactEmail?.trim()) {
    return json({ error: "All required fields must be filled in." }, 400);
  }

  if (description.trim().length < 50) {
    return json({ error: "Description must be at least 50 characters." }, 400);
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
    city: city.trim(),
    region: region?.trim() || null,
    country: country.trim(),
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
