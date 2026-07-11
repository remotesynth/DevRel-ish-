import { db, AppUser, Groups, Meetups } from "astro:db";

export default async function seed() {
  // Dev seed uses placeholder DIDs — in production, real DIDs come from ATProto OAuth.
  const adminDid = "did:plc:admin-devrelish";
  const alexDid = "did:plc:alex-devrelish";
  const samDid = "did:plc:sam-devrelish";

  // ── AppUsers ──────────────────────────────────────────────────────────────

  await db.insert(AppUser).values([
    {
      did: adminDid,
      handle: "admin.devrelish.tech",
      displayName: "Site Admin",
      role: "admin",
      createdAt: new Date(),
    },
    {
      did: alexDid,
      handle: "alex.bsky.social",
      displayName: "Alex Chen",
      role: "user",
      groupId: "group-sf",
      createdAt: new Date(),
    },
    {
      did: samDid,
      handle: "sam.bsky.social",
      displayName: "Sam Rivera",
      role: "user",
      groupId: "group-nyc",
      createdAt: new Date(),
    },
  ]);

  // ── Groups ────────────────────────────────────────────────────────────────

  await db.insert(Groups).values([
    {
      id: "group-sf",
      name: "DevRel(ish) San Francisco",
      slug: "san-francisco",
      customSlug: "devrel-sf",
      category: "devrel",
      tagline: "Putting faces to the names you see in Slack",
      city: "San Francisco",
      region: "CA",
      country: "USA",
      description:
        "A cozy gathering for DevRel folks, developer advocates, community managers, and anyone who finds themselves doing the job without the title. We meet monthly to commiserate, celebrate, and remind each other we're not alone in the universe.",
      contactEmail: "alex@example.com",
      status: "active",
      managerId: alexDid,
      createdAt: new Date(),
    },
    {
      id: "group-nyc",
      name: "Cloud Native NYC",
      slug: "cloud-native-nyc",
      customSlug: "cloud-native-nyc",
      category: "cloud-native",
      tagline: "Kubernetes, containers, and good company in New York",
      city: "New York",
      region: "NY",
      country: "USA",
      description:
        "Where the cloud-native people of NYC come to breathe, laugh, and talk shop away from the keyboard. Join us for casual get-togethers across the five boroughs — operators, platform engineers, and the SRE crowd all welcome.",
      contactEmail: "sam@example.com",
      status: "active",
      managerId: samDid,
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
      city: "San Francisco",
      country: "USA",
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
      city: "San Francisco",
      country: "USA",
      capacity: 25,
      createdAt: new Date(),
    },
    {
      id: "meetup-003",
      groupId: "group-nyc",
      title: "Rooftop Mixer – Cloud Native Edition",
      description:
        "Views of the skyline, good vibes, great company. Come hang out with other cloud-native folks and remember why you love this weird, wonderful infrastructure.",
      date: nextMonth,
      time: "18:00",
      venue: "230 Fifth Rooftop Bar",
      address: "230 5th Ave, New York, NY 10001",
      city: "New York",
      country: "USA",
      capacity: 50,
      createdAt: new Date(),
    },
  ]);
}
