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

/**
 * Loose email format check — not a full RFC 5322 implementation (those are
 * famously gnarly), just a sanity guard against obviously-invalid inputs
 * that would otherwise slip through to the mail extension. We require at
 * least one char before `@`, at least one before the dot, and a TLD char.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/**
 * HTML-escape user-controlled strings before interpolating into email HTML
 * bodies. Centralized here so admin-invites and player-invites use the same
 * escape rules — `&` first to avoid double-escaping the entities below.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
