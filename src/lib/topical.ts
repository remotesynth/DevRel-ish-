/**
 * Deciding whether an event from the network belongs on DevRel(ish).
 *
 * `community.lexicon.calendar.event` is shared by the whole Atmosphere, not
 * just by tech. Indexing it unfiltered means the network rail fills with
 * ecstatic dance, moon circles, and breathwork retreats — real events, real
 * people, entirely the wrong site.
 *
 * The approach is deliberately dumb and inspectable: score the title and
 * description against a vocabulary, keep what clears the bar, and store which
 * terms matched so a wrong call can be diagnosed rather than guessed at.
 * A smarter classifier would be less predictable and much harder to correct.
 *
 * Two rules make it behave:
 *  - Whole-word matching only. Substring matching turns "Go" into "Going" and
 *    "AI" into "said" — the two failure modes that make keyword filters useless.
 *  - URLs are stripped before matching. A Facebook CDN link ending "emoji.php"
 *    scored a poetry event as a PHP meetup; a description that merely names the
 *    video-conferencing tool it uses matched "open source" and "tech".
 *  - The title must carry signal. Both false positives found in real indexed
 *    data had entirely non-technical titles and matched only on passing
 *    mentions in the body. An event whose title says nothing about tech is one
 *    a reader browsing a rail couldn't identify either.
 */

/** Terms that, on their own, mean an event is about technology. */
const STRONG = [
  // practice
  "developer relations", "devrel", "developer advocacy", "developer advocate",
  "developer experience", "devex", "technical writing", "documentation",
  "api design", "open source", "oss", "software", "programming", "coding",
  "developer", "developers", "engineer", "engineering", "engineers",
  // platform
  "cloud native", "kubernetes", "k8s", "docker", "containers", "serverless",
  "devops", "platform engineering", "observability", "sre", "infrastructure",
  "microservices", "terraform", "ci/cd",
  // data + ai
  "machine learning", "deep learning", "data science", "data engineering",
  "llm", "llms", "genai", "mlops", "artificial intelligence", "neural network",
  // web + mobile
  "web development", "frontend", "front-end", "backend", "back-end",
  "full stack", "fullstack", "javascript", "typescript", "react", "vue",
  "svelte", "angular", "node.js", "nodejs", "deno", "bun", "webassembly",
  "wasm", "css", "html", "ios", "android", "swift", "kotlin", "flutter",
  "react native",
  // languages + runtimes
  "python", "rust", "golang", "java", "c++", "c#", ".net", "php", "ruby",
  "rails", "elixir", "haskell", "scala", "clojure", "zig",
  // data stores
  "postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis", "kafka",
  "database", "databases", "graphql", "sql",
  // security
  "cybersecurity", "appsec", "infosec", "security", "pentest", "cryptography",
  // adjacent practice
  "game development", "gamedev", "design systems", "product management",
  "indie hacking", "hackathon", "hack night", "code jam", "tech talk",
  "lightning talks", "user group", "meetup for developers",
  // ecosystem this site lives in
  "atproto", "at protocol", "bluesky", "fediverse", "activitypub",
  "decentralized", "self-hosted", "homelab", "linux", "git", "github",
  // named communities and conferences — a great many tech meetups say only
  // their community's name in the title ("PyData Berlin monthly"), which
  // otherwise scores nothing at all
  "pydata", "pycon", "jsconf", "cityjs", "droidcon", "rubyconf", "railsconf",
  "fosdem", "devfest", "devopsdays", "kcd", "cncf", "wordcamp", "drupalcamp",
  "google developer group", "gdg", "aws user group", "aws", "azure", "gcp",
  "hashicorp", "laravel", "django", "flask", "spring boot", "dotnet",
  "unity engine", "unreal engine", "figma", "webflow", "shopify",
  "indie hackers", "indie hacker", "coderdojo", "code club", "freecodecamp",
] as const;

/**
 * Terms that suggest tech but are too common to stand alone. Two of these, or
 * one alongside anything above, clears the bar. "Community" and "startup"
 * appear in a great many non-technical event titles.
 */
const WEAK = [
  "tech", "technology", "technical", "startup", "startups", "founders",
  "product", "design", "ux", "ui", "data", "api", "apis", "cloud", "digital",
  "computer", "computing", "code", "hacker", "hackers", "build", "builders",
  "community", "workshop", "conference", "protocol", "platform", "ai", "ml",
] as const;

/**
 * Terms that mean an event is NOT for this site even when it trips a keyword.
 * "Sound healing" mentions "sound"; a "digital detox retreat" mentions
 * "digital". These are drawn from what actually turned up in the index.
 */
const EXCLUDE = [
  "ecstatic dance", "sound bath", "sound healing", "breathwork", "chakra",
  "reiki", "yoga", "kundalini", "shamanic", "tantra", "astrology", "tarot",
  "moon circle", "womb", "somatic", "psychedelic", "ayahuasca", "cacao",
  "sadhana", "meditation retreat", "silent retreat", "grief", "brainspotting",
  "massage", "acupuncture", "crystal", "manifesting", "energy healing",
  "wellness retreat", "detox", "forage", "foraging", "permaculture",
] as const;

export interface TopicalVerdict {
  topical: boolean;
  score: number;
  /** The terms that decided it — stored so a wrong call is diagnosable. */
  terms: string[];
}

/**
 * Strip anything that isn't prose. URLs and markdown link targets carry tokens
 * that have nothing to do with the event's subject.
 */
function proseOnly(text: string): string {
  return text
    .replace(/\]\([^)]*\)/g, "]")          // markdown link targets
    .replace(/https?:\/\/\S+/g, " ")        // bare URLs
    .replace(/\S+\.(com|org|net|io|dev|app|co|uk|de)\b\S*/gi, " "); // bare domains
}

/** Whole-word (or whole-phrase) match, so "Go" doesn't match "Going". */
function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b fails on terms ending in punctuation (".net", "c++"), so bound on
  // non-word characters or string edges instead.
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/**
 * Decide whether a network event belongs on DevRel(ish).
 *
 * @param name        the event title — weighted double
 * @param description the event body, if any
 * @param claimed     true when a DevRel(ish) group has claimed this event via
 *                    com.devrelish.event.meta, which settles it outright
 */
export function classifyEvent(
  name: string | null | undefined,
  description?: string | null,
  claimed = false
): TopicalVerdict {
  if (claimed) return { topical: true, score: 99, terms: ["claimed-by-group"] };

  const title = proseOnly((name ?? "").toLowerCase());
  const body = proseOnly((description ?? "").toLowerCase());
  const all = `${title} ${body}`;

  const excluded = EXCLUDE.filter((t) => mentions(all, t));
  if (excluded.length > 0) {
    return { topical: false, score: -1, terms: excluded.map((t) => `-${t}`) };
  }

  const terms: string[] = [];
  let score = 0;
  let titleScore = 0;

  for (const t of STRONG) {
    if (mentions(title, t)) { score += 4; titleScore += 4; terms.push(t); }
    else if (mentions(body, t)) { score += 2; terms.push(t); }
  }
  for (const t of WEAK) {
    if (mentions(title, t)) { score += 2; titleScore += 2; terms.push(t); }
    else if (mentions(body, t)) { score += 1; terms.push(t); }
  }

  // The title must say something, and the whole record must clear 4. One strong
  // term in the title passes on its own; a pile of passing body mentions does not.
  const topical = titleScore >= 2 && score >= 4;
  return { topical, score, terms: terms.slice(0, 8) };
}
