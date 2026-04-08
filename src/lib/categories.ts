export const CATEGORIES = [
  // Technical Practice
  { slug: "devrel",               label: "Developer Relations" },
  { slug: "developer-advocacy",   label: "Developer Advocacy" },
  { slug: "dx",                   label: "Developer Experience (DX)" },
  { slug: "open-source",          label: "Open Source" },
  { slug: "technical-writing",    label: "Technical Writing" },
  { slug: "developer-education",  label: "Developer Education" },
  { slug: "api-design",           label: "API Design & Standards" },
  { slug: "security",             label: "Security & AppSec" },
  // Platform & Ecosystem
  { slug: "cloud-native",         label: "Cloud Native & Kubernetes" },
  { slug: "data-ai",              label: "Data, AI & ML" },
  { slug: "web-dev",              label: "Web Development" },
  { slug: "mobile",               label: "Mobile Development" },
  { slug: "platform-engineering", label: "Platform Engineering" },
  { slug: "observability",        label: "Observability & SRE" },
  { slug: "databases",            label: "Databases" },
  // Professional & Career
  { slug: "product-management",        label: "Product Management" },
  { slug: "engineering-leadership",    label: "Engineering Leadership" },
  { slug: "startup-founders",          label: "Startup Founders & Builders" },
  { slug: "community-building",        label: "Community Building" },
  { slug: "women-in-tech",             label: "Women in Tech" },
  { slug: "underrepresented-in-tech",  label: "Underrepresented in Tech" },
  // Adjacent Creator & Practitioner
  { slug: "tech-podcasting",        label: "Tech Podcasting & Audio" },
  { slug: "tech-content-creation",  label: "Tech Content Creation" },
  { slug: "game-dev",               label: "Game Development" },
  { slug: "design-systems",         label: "Design Systems & UX" },
  { slug: "indie-hacking",          label: "Indie Hacking & Side Projects" },
  { slug: "local-tech-community",   label: "Local Tech Community" },
  { slug: "tech-events",            label: "Tech Events & Conferences" },
] as const;

export type CategorySlug = typeof CATEGORIES[number]["slug"];

export function getCategoryLabel(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  return CATEGORIES.find(c => c.slug === slug)?.label;
}
