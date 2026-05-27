/**
 * Playwright global setup: ensures the Firebase emulators have a known set
 * of test users (organizer, admin/superadmin, regular player) plus their
 * `/users/{uid}` profile docs before any spec runs. Run automatically by
 * Playwright before any worker starts.
 *
 * The Auth emulator accepts any API key — we hit the standard
 * identitytoolkit REST API. The Firestore emulator honors security rules
 * by default, BUT it also accepts an `Authorization: Bearer owner` header
 * that bypasses rules entirely — that's what `seedDoc` below uses (no need
 * to pull in firebase-admin for a one-shot seed).
 *
 * Idempotent: leftover users from a previous run are treated as "already
 * seeded" (EMAIL_EXISTS isn't an error, we just look up the existing uid
 * and re-write their profile doc to known-good values).
 */
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"
const FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "padel-galaxy-e2e"

export type SeededUser = {
  /** Stable test-side identifier (key in E2E_USERS below). */
  key: "organizer" | "admin" | "player"
  email: string
  password: string
  displayName: string
  /** Role to seed in /users/{uid}. */
  role: "superadmin" | "admin" | "player"
  /** Custom claims to set on the Auth account (so security rules see them). */
  claims: Record<string, unknown>
  /** Populated by `globalSetup`; useful for specs that need to assert by uid. */
  uid?: string
}

/**
 * The user set is exported so individual specs can pick which identity to
 * sign in as. Mutated in-place by globalSetup to backfill `uid` after the
 * Auth emulator assigns one.
 *
 * Roles:
 *   - organizer: regular user (role "player" in /users) — the legacy fixture.
 *     "organizer" here means "the user that creates pozos / owns the roster".
 *     Note: in our app a vanilla "player"-role user CAN still create pozos
 *     and roster (Firestore rules only require ownerId == auth.uid).
 *   - admin: superadmin tier — sees /admin link, can manage other admins.
 *   - player: vanilla "player" role too, but with NO owned data. Used to
 *     verify the read-only / restricted-access behaviors.
 */
export const E2E_USERS: Record<SeededUser["key"], SeededUser> = {
  organizer: {
    key: "organizer",
    email: "e2e@padel.test",
    password: "padel-e2e-123",
    displayName: "E2E Tester",
    // The "organizer" tier creates pozos, players, and groups. After
    // `/pozos/nuevo` got gated on RequireAdmin, the organizer needs admin
    // role (not just player) to access the creation flow. Also stamps the
    // `admin` claim so isAdmin() returns true via the cheap token path —
    // without it the first render would be missing the "Crear pozo" CTA
    // until the /users doc subscription resolved.
    role: "admin",
    claims: { admin: true },
  },
  admin: {
    key: "admin",
    email: "admin@padel.test",
    password: "padel-admin-123",
    displayName: "E2E Admin",
    role: "superadmin",
    // Both claims set so isAdmin() in firestore.rules works via the cheap
    // claim path (no /users/{uid} doc lookup needed for admin gating).
    claims: { admin: true, superadmin: true },
  },
  player: {
    key: "player",
    email: "player@padel.test",
    password: "padel-player-123",
    displayName: "E2E Player",
    role: "player",
    claims: {},
  },
}

/** Backwards compat for the existing pozo-flow.spec — kept as an alias. */
export const E2E_USER = E2E_USERS.organizer

const IDENTITY_BASE = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
const FIRESTORE_BASE = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/**
 * Either creates the auth user or looks up the existing one (EMAIL_EXISTS).
 * Returns the local uid so we can write a /users/{uid} doc with a matching key.
 */
async function ensureUser(user: SeededUser): Promise<string> {
  const signUpRes = await fetch(`${IDENTITY_BASE}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Auth emulator routes by project header rather than the API key.
      "X-Goog-Project-Id": PROJECT_ID,
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      returnSecureToken: true,
    }),
  })

  if (signUpRes.ok) {
    const body = (await signUpRes.json()) as { localId: string }
    return body.localId
  }

  const errBody = (await signUpRes.json().catch(() => ({}))) as {
    error?: { message?: string }
  }
  const message = errBody.error?.message ?? ""
  if (!message.includes("EMAIL_EXISTS")) {
    throw new Error(`Failed to seed ${user.email}: ${signUpRes.status} ${message}`)
  }

  // Already exists — look up the uid via the emulator lookup endpoint.
  const lookupRes = await fetch(`${IDENTITY_BASE}/accounts:lookup?key=fake-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Project-Id": PROJECT_ID,
    },
    body: JSON.stringify({ email: [user.email] }),
  })
  if (!lookupRes.ok) {
    throw new Error(`Failed to look up ${user.email}: ${lookupRes.status}`)
  }
  const lookupBody = (await lookupRes.json()) as {
    users?: Array<{ localId: string }>
  }
  const uid = lookupBody.users?.[0]?.localId
  if (!uid) throw new Error(`No uid found for ${user.email}`)
  return uid
}

/**
 * Finalize the auth account after signUp: stamp email_verified=true so the
 * user passes the firestore.rules `hasVerifiedEmail()` gate, and apply any
 * custom claims (admin/superadmin).
 *
 * Uses the same `accounts:update` endpoint the Admin SDK uses, with the
 * emulator's `Bearer owner` escape hatch so the request is treated as admin
 * (otherwise privileged fields like `emailVerified` and `customAttributes`
 * would be rejected).
 *
 * IMPORTANT: marking email_verified=true is REQUIRED for any rule that
 * depends on `hasVerifiedEmail()` — admin invite consumption, /adminInvites
 * self-read/delete, /players claim path, and the doc-lookup branch of
 * isAdmin(). Without this, signed-in test users would be treated as
 * "unverified email" and many flows would fail under the hardened rules.
 */
async function finalizeAuthAccount(
  uid: string,
  claims: Record<string, unknown>,
): Promise<void> {
  const body: Record<string, unknown> = {
    localId: uid,
    emailVerified: true,
  }
  if (Object.keys(claims).length > 0) {
    // customAttributes must be a JSON-encoded STRING, mirroring the
    // Admin SDK's setCustomUserClaims wire format.
    body.customAttributes = JSON.stringify(claims)
  }
  const res = await fetch(`${IDENTITY_BASE}/accounts:update?key=fake-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Project-Id": PROJECT_ID,
      // The Auth emulator treats this header as an admin/root context, so
      // privileged fields are accepted. Without it the request comes in as
      // an end-user and those fields are stripped.
      Authorization: "Bearer owner",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`finalizeAuthAccount(${uid}) failed: ${res.status} ${text}`)
  }
}

/**
 * Encodes a JS value into Firestore REST `Value` shape. Only handles the
 * primitives we actually seed (strings + ints) — extend if needed.
 */
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return { stringValue: value }
  if (typeof value === "number" && Number.isInteger(value)) {
    return { integerValue: String(value) }
  }
  if (typeof value === "boolean") return { booleanValue: value }
  if (value === null) return { nullValue: null }
  throw new Error(`toFirestoreValue: unsupported type ${typeof value}`)
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v)
  return fields
}

/**
 * Upsert a Firestore doc at `path` (e.g. "users/abc123"). Uses
 * `Authorization: Bearer owner` — a Firestore emulator escape hatch that
 * bypasses security rules during seeding. Without it we'd be limited to
 * what each user can write per the rules (and the /users/{uid} create rule
 * is restrictive).
 */
async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`seedDoc(${path}) failed: ${res.status} ${text}`)
  }
}

async function seedOne(user: SeededUser): Promise<void> {
  const uid = await ensureUser(user)
  user.uid = uid
  await finalizeAuthAccount(uid, user.claims)
  // Pre-seed the /users/{uid} profile doc with the desired role. When the
  // user signs in, `ensureUserProfile` finds an existing doc with `role`
  // and goes into the "refresh mirrored fields" branch — it WON'T downgrade
  // role, so the seeded role sticks.
  await seedDoc(`users/${uid}`, {
    uid,
    email: user.email.toLowerCase(),
    displayName: user.displayName,
    preferredSide: "any",
    role: user.role,
    createdAt: 0,
    updatedAt: 0,
  })
}

/**
 * Seeds a /players doc owned by the organizer with `linkedUid` set to the
 * player user. Mirrors the production state of "cliente accepted invite +
 * has been linked to a roster record", which is what enables the "Mi
 * perfil" nav item for the player in the site header.
 *
 * Constant id so the player-flow spec can reason about the URL it ends up
 * on without having to scrape the navigation link.
 */
export const E2E_LINKED_PLAYER_ID = "e2e-linked-player"

async function seedLinkedPlayer(
  organizer: SeededUser,
  player: SeededUser,
): Promise<void> {
  if (!organizer.uid || !player.uid) {
    throw new Error("seedLinkedPlayer: organizer/player uids not populated")
  }
  await seedDoc(`players/${E2E_LINKED_PLAYER_ID}`, {
    id: E2E_LINKED_PLAYER_ID,
    ownerId: organizer.uid,
    name: player.displayName,
    nameLower: player.displayName.toLowerCase(),
    linkedUid: player.uid,
    invitedEmail: player.email.toLowerCase(),
    invitedAt: 0,
    createdAt: 0,
    updatedAt: 0,
  })
}

export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log(
    `[e2e] seeding ${Object.keys(E2E_USERS).length} users in ${AUTH_EMULATOR_HOST}…`,
  )
  // Run in parallel — the operations don't depend on each other.
  await Promise.all(Object.values(E2E_USERS).map(seedOne))
  // After every user has a uid, link the player fixture to a roster doc
  // owned by the organizer. This makes the player's "Mi perfil" nav item
  // resolve to a real /jugadores/:id page in the player-flow specs.
  await seedLinkedPlayer(E2E_USERS.organizer, E2E_USERS.player)
  // eslint-disable-next-line no-console
  console.log(
    `[e2e] seed OK (${Object.values(E2E_USERS)
      .map((u) => `${u.key}=${u.uid?.slice(0, 6)}`)
      .join(", ")}, linkedPlayer=${E2E_LINKED_PLAYER_ID})`,
  )
}
