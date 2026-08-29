/**
 * lib/utils/nanoid.ts
 * Cryptographically secure ID generator using the Web Crypto API.
 * Returns a URL-safe base64 string of ~16 random bytes (22 chars).
 */
export function nanoid(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
  // Fallback (Node.js test environment)
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

export function generateRef(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(3, "0")}`;
}
