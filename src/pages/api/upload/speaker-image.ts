import type { APIRoute } from "astro";
import { v2 as cloudinary } from "cloudinary";
import { db, Groups } from "astro:db";
import { eq } from "astro:db";

export const prerender = false;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Module-level config so it's set before any request arrives
cloudinary.config({
  cloud_name: import.meta.env.CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized." }, 401);

  const groupId = locals.user.groupId;
  if (!groupId) return json({ error: "No group associated with your account." }, 403);
  const [group] = await db.select().from(Groups).where(eq(Groups.id, groupId));
  if (!group || group.status !== "active") return json({ error: "Group not approved." }, 403);

  if (!import.meta.env.CLOUDINARY_CLOUD_NAME || !import.meta.env.CLOUDINARY_API_KEY || !import.meta.env.CLOUDINARY_API_SECRET) {
    return json({ error: "Image upload is not configured on this server." }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File)) return json({ error: "No image provided." }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return json({ error: "Only JPEG, PNG, and WebP images are allowed." }, 400);
  if (file.size > MAX_FILE_SIZE) return json({ error: "Image must be under 5MB." }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const b64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  // Upload without transformation so the signature stays simple.
  // Transformation is baked into the returned URL instead (Cloudinary applies it on-the-fly).
  const result = await cloudinary.uploader.upload(b64, {
    folder: "devrelish/speakers",
  });

  // Insert face-crop transform into the URL path
  const url = result.secure_url.replace("/upload/", "/upload/c_fill,g_face,h_400,w_400/");

  return json({ url });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
