const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Browser sessions use cookies, so every state-changing request must originate
 * from this application. Prefer Origin and fall back to Referer for older form
 * submissions that omit Origin.
 */
export function hasTrustedRequestOrigin(request: Request, expectedOrigin: string): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}
