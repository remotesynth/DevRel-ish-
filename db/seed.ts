import { db, Groups, Meetups, User, Account } from "astro:db";
import { hashPassword } from "better-auth/crypto";

export default async function seed() {
  const adminId = "admin-001";
  const managerId = "manager-001";
  const manager2Id = "manager-002";

  // Hash passwords using better-auth's own scrypt implementation
  // Dev credentials — change these in production
  const [adminHash, alexHash, samHash] = await Promise.all([
    hashPassword("admin-devrelish"),
    hashPassword("alex-devrelish"),
    hashPassword("sam-devrelish"),
  ]);

  // ── Users ────────────────────────────────────────────────────────────────

  await db.insert(User).values([
    {
      id: adminId,
      name: "Site Admin",
      email: "admin@devrelish.tech",
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: managerId,
      name: "Alex Chen",
      email: "alex@example.com",
      emailVerified: true,
      role: "user",
      groupId: "group-sf",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: manager2Id,
      name: "Sam Rivera",
      email: "sam@example.com",
      emailVerified: true,
      role: "user",
      groupId: "group-nyc",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // ── Accounts (credential records for email/password login) ────────────────

  await db.insert(Account).values([
    {
      id: "account-admin",
      accountId: adminId,
      providerId: "credential",
      userId: adminId,
      password: adminHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "account-alex",
      accountId: managerId,
      providerId: "credential",
      userId: managerId,
      password: alexHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "account-sam",
      accountId: manager2Id,
      providerId: "credential",
      userId: manager2Id,
      password: samHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  // ── Groups ────────────────────────────────────────────────────────────────

  await db.insert(Groups).values([
    {
      id: "group-sf",
      name: "DevRel(ish) San Francisco",
      slug: "san-francisco",
      city: "San Francisco",
      region: "CA",
      country: "USA",
      description:
        "A cozy gathering for DevRel folks, developer advocates, community managers, and anyone who finds themselves doing the job without the title. We meet monthly to commiserate, celebrate, and remind each other we're not alone in the universe.",
      contactEmail: "alex@example.com",
      status: "approved",
      managerId: managerId,
      createdAt: new Date(),
    },
    {
      id: "group-nyc",
      name: "DevRel(ish) New York",
      slug: "new-york",
      city: "New York",
      region: "NY",
      country: "USA",
      description:
        "Where the DevRel people of NYC come to breathe, laugh, and remember that IRL connections are still the best kind. Join us for casual get-togethers across the five boroughs.",
      contactEmail: "sam@example.com",
      status: "approved",
      managerId: manager2Id,
      createdAt: new Date(),
    },
    {
      id: "group-pending",
      name: "DevRel(ish) Austin",
      slug: "austin",
      city: "Austin",
      region: "TX",
      country: "USA",
      description:
        "Keeping Austin weird and developer-friendly. A meetup for the DevRel crowd who want to connect face-to-face in the live music capital of the world.",
      contactEmail: "pending@example.com",
      status: "pending",
      createdAt: new Date(),
    },
  ]);

  // ── Meetups ───────────────────────────────────────────────────────────────

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(15);

  const twoMonths = new Date();
  twoMonths.setMonth(twoMonths.getMonth() + 2);
  twoMonths.setDate(8);

  await db.insert(Meetups).values([
    {
      id: "meetup-001",
      groupId: "group-sf",
      title: "Spring Social Gathering",
      description:
        "Kick off spring with fellow DevRel humans! We'll have good drinks, better conversation, and zero conference talk. Come as you are, stay as long as you want.",
      date: nextMonth,
      time: "18:30",
      venue: "The Interval at Long Now",
      address: "2 Marina Blvd, San Francisco, CA 94123",
      capacity: 40,
      createdAt: new Date(),
    },
    {
      id: "meetup-002",
      groupId: "group-sf",
      title: "Burnout? Let's Talk.",
      description:
        "An open, honest conversation about the realities of DevRel: the travel, the loneliness, the metrics that don't capture what we do. Cathartic and community-building.",
      date: twoMonths,
      time: "19:00",
      venue: "Sightglass Coffee",
      address: "270 7th St, San Francisco, CA 94103",
      capacity: 25,
      createdAt: new Date(),
    },
    {
      id: "meetup-003",
      groupId: "group-nyc",
      title: "Rooftop Mixer – DevRel Edition",
      description:
        "Views of the skyline, good vibes, great company. Come hang out with other DevRel-adjacent folks and remember why you love this weird, wonderful job.",
      date: nextMonth,
      time: "18:00",
      venue: "230 Fifth Rooftop Bar",
      address: "230 5th Ave, New York, NY 10001",
      capacity: 50,
      createdAt: new Date(),
    },
  ]);
}
