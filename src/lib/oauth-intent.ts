export const OAUTH_INTENT_COOKIE = "devrelish_oauth_intent";

const PUBLISHER_PREFIX = "publisher:";

export function publisherIntent(groupId: string): string {
  return `${PUBLISHER_PREFIX}${groupId}`;
}

export function publisherIntentGroupId(value: string | undefined): string | null {
  if (!value?.startsWith(PUBLISHER_PREFIX)) return null;
  const groupId = value.slice(PUBLISHER_PREFIX.length);
  return groupId && /^[a-z0-9-]+$/i.test(groupId) ? groupId : null;
}

export const OAUTH_INTENT_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: !import.meta.env.DEV,
  maxAge: 10 * 60,
};
