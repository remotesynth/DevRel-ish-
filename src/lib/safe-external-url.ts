import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (isIP(address) === 6) {
    const lowered = address.toLowerCase();
    return lowered !== "::1" && !lowered.startsWith("fe80:") && !lowered.startsWith("fc") && !lowered.startsWith("fd");
  }
  return false;
}

/**
 * Validate an untrusted endpoint before server-side fetches. DID documents are
 * user-controlled data, so accepting loopback/private hosts here would turn
 * public event lookups into an SSRF primitive.
 */
export async function safeExternalHttpsUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname)) return null;

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicIp(address)) ? url : null;
  } catch {
    return null;
  }
}

export { isPublicIp as isPublicIpAddress };
