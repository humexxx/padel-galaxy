import { createHmac, timingSafeEqual } from "node:crypto"

export { SESSION_COOKIE, SESSION_MAX_AGE } from "./auth-constants"

function getCredentials() {
  const email = process.env.AUTH_EMAIL ?? "test@test.com"
  const password = process.env.AUTH_PASSWORD ?? "test1234"
  const secret = process.env.AUTH_SECRET ?? "padel-galaxy-default-secret-change-me"
  return { email, password, secret }
}

export function signToken(email: string): string {
  const { secret } = getCredentials()
  return createHmac("sha256", secret).update(email).digest("hex")
}

export function verifyCredentials(email: string, password: string): boolean {
  const creds = getCredentials()
  const e1 = Buffer.from(email)
  const e2 = Buffer.from(creds.email)
  const p1 = Buffer.from(password)
  const p2 = Buffer.from(creds.password)
  if (e1.length !== e2.length || p1.length !== p2.length) return false
  return timingSafeEqual(e1, e2) && timingSafeEqual(p1, p2)
}

export function expectedToken(): string {
  const { email } = getCredentials()
  return signToken(email)
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false
  const expected = expectedToken()
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
