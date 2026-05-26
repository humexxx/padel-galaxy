/**
 * Email helpers. Lives in its own module to break a circular dep between
 * `user-profile`, `admin-invites`, and `invites` — all three need to
 * canonicalize emails the same way, and previously two of them imported
 * `normalizeEmail` from `user-profile`, which itself imports them back.
 *
 * Keep this file dependency-free at the project level (no `@/lib/*`
 * imports) so it can be imported by anything without introducing a cycle.
 */

/**
 * Lowercased + trimmed email used as the canonical key for invites, doc
 * ids, and dedup. RFC 5321 says local-parts are technically case-sensitive
 * but no real-world mail server respects that, so we treat addresses as
 * case-insensitive.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
