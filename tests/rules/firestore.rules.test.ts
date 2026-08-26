import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rulesPath = resolve(__dirname, "../../firestore.rules")

const PROJECT_ID = "padel-galaxy-rules-test"
const OWNER = "owner-alice"
const OTHER = "user-bob"
const LINKED = "user-charlie"
const ADMIN = "admin-zoe"

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(rulesPath, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

function owner() {
  return env.authenticatedContext(OWNER).firestore()
}
function other() {
  return env.authenticatedContext(OTHER).firestore()
}
function linked() {
  return env.authenticatedContext(LINKED).firestore()
}
function admin() {
  return env.authenticatedContext(ADMIN, { admin: true }).firestore()
}
/**
 * Superadmin variant: both `superadmin` and `admin` claims set. Required
 * by the /settings rule (which is gated on isSuperAdminClaim, not the
 * weaker isAdmin) and by /users role-change updates.
 */
function superAdmin() {
  return env
    .authenticatedContext(ADMIN, { admin: true, superadmin: true })
    .firestore()
}
/**
 * Authenticated context bound to a specific email. Required to test
 * rules that look at `request.auth.token.email` (e.g. /adminInvites
 * self-claim, /players invitedEmail). Pass the lowercased email so it
 * matches the rule's `.lower()` normalization.
 *
 * Defaults to email_verified=true because that's the common path; tests
 * for the security guard explicitly pass `{ verified: false }` to assert
 * that the rule rejects unverified emails.
 */
function authedAs(
  uid: string,
  email: string,
  opts: { verified?: boolean } = {},
) {
  return env
    .authenticatedContext(uid, {
      email,
      email_verified: opts.verified !== false,
    })
    .firestore()
}
function anon() {
  return env.unauthenticatedContext().firestore()
}

/** Seed a doc bypassing rules (so tests can assert read/update/delete). */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data)
  })
}

// ============================================================================
// /pozos
// ============================================================================

describe("/pozos/{id}", () => {
  const pozo = {
    id: "p1",
    ownerId: OWNER,
    name: "Pozo",
    createdAt: 0,
    status: "draft",
    config: {},
    players: [],
    matches: [],
  }

  describe("create", () => {
    it("allows owner to create with their own uid as ownerId", async () => {
      await assertSucceeds(setDoc(doc(owner(), "pozos/p1"), pozo))
    })

    it("denies creating with someone else's uid as ownerId", async () => {
      await assertFails(
        setDoc(doc(owner(), "pozos/p1"), { ...pozo, ownerId: OTHER }),
      )
    })

    it("denies unauthenticated create", async () => {
      await assertFails(setDoc(doc(anon(), "pozos/p1"), pozo))
    })
  })

  describe("read", () => {
    beforeEach(() => seed("pozos/p1", pozo))

    it("allows the owner to read their own pozo", async () => {
      await assertSucceeds(getDoc(doc(owner(), "pozos/p1")))
    })

    it("denies another authenticated user from reading", async () => {
      await assertFails(getDoc(doc(other(), "pozos/p1")))
    })

    it("allows an admin to read any pozo", async () => {
      await assertSucceeds(getDoc(doc(admin(), "pozos/p1")))
    })

    it("denies unauthenticated reads", async () => {
      await assertFails(getDoc(doc(anon(), "pozos/p1")))
    })
  })

  describe("update", () => {
    beforeEach(() => seed("pozos/p1", pozo))

    it("allows the owner to update without changing ownerId", async () => {
      await assertSucceeds(
        updateDoc(doc(owner(), "pozos/p1"), { name: "Pozo nuevo" }),
      )
    })

    it("denies the owner from changing the ownerId", async () => {
      await assertFails(
        updateDoc(doc(owner(), "pozos/p1"), { ownerId: OTHER }),
      )
    })

    it("denies another user from updating", async () => {
      await assertFails(updateDoc(doc(other(), "pozos/p1"), { name: "Hack" }))
    })

    it("admin can update but still can't change ownerId", async () => {
      await assertSucceeds(updateDoc(doc(admin(), "pozos/p1"), { name: "Admin set" }))
      await assertFails(updateDoc(doc(admin(), "pozos/p1"), { ownerId: OTHER }))
    })
  })

  describe("delete", () => {
    beforeEach(() => seed("pozos/p1", pozo))

    it("allows the owner to delete", async () => {
      await assertSucceeds(deleteDoc(doc(owner(), "pozos/p1")))
    })

    it("denies another user from deleting", async () => {
      await assertFails(deleteDoc(doc(other(), "pozos/p1")))
    })

    it("admin can delete", async () => {
      await assertSucceeds(deleteDoc(doc(admin(), "pozos/p1")))
    })
  })
})

// ============================================================================
// /players
// ============================================================================

describe("/players/{id}", () => {
  const player = {
    id: "pl1",
    ownerId: OWNER,
    name: "Ana",
    nameLower: "ana",
    linkedUid: null as string | null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
  }

  describe("create", () => {
    it("allows the owner to create with their own uid", async () => {
      await assertSucceeds(setDoc(doc(owner(), "players/pl1"), player))
    })

    it("denies creating with someone else's uid as ownerId", async () => {
      await assertFails(
        setDoc(doc(owner(), "players/pl1"), { ...player, ownerId: OTHER }),
      )
    })

    it("denies unauthenticated create", async () => {
      await assertFails(setDoc(doc(anon(), "players/pl1"), player))
    })
  })

  describe("read", () => {
    beforeEach(() => seed("players/pl1", { ...player, linkedUid: LINKED }))

    it("allows the owner to read their roster", async () => {
      await assertSucceeds(getDoc(doc(owner(), "players/pl1")))
    })

    it("allows the linked user (the player) to read their own record", async () => {
      await assertSucceeds(getDoc(doc(linked(), "players/pl1")))
    })

    it("denies a random authenticated user from reading", async () => {
      await assertFails(getDoc(doc(other(), "players/pl1")))
    })

    it("denies unauthenticated reads", async () => {
      await assertFails(getDoc(doc(anon(), "players/pl1")))
    })

    it("allows admin to read any player", async () => {
      await assertSucceeds(getDoc(doc(admin(), "players/pl1")))
    })

    it("does NOT leak players where linkedUid is null to non-owners", async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "players/pl2"), {
          ...player,
          id: "pl2",
          linkedUid: null,
        })
      })
      await assertFails(getDoc(doc(other(), "players/pl2")))
    })
  })

  describe("update", () => {
    beforeEach(() => seed("players/pl1", player))

    it("allows the owner to update", async () => {
      await assertSucceeds(
        updateDoc(doc(owner(), "players/pl1"), { name: "Ana M.", nameLower: "ana m." }),
      )
    })

    it("denies changing the ownerId on update", async () => {
      await assertFails(
        updateDoc(doc(owner(), "players/pl1"), { ownerId: OTHER }),
      )
    })

    it("denies the linked user from updating their own record", async () => {
      // The linked user can READ their record but not edit (that's the
      // organizer's responsibility). Tightening this avoids the linked
      // user accidentally renaming themselves in everyone's pozos.
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "players/pl1"), {
          ...player,
          linkedUid: LINKED,
        })
      })
      await assertFails(
        updateDoc(doc(linked(), "players/pl1"), { name: "Otro" }),
      )
    })

    it("denies a random authenticated user from updating", async () => {
      await assertFails(updateDoc(doc(other(), "players/pl1"), { name: "X" }))
    })
  })

  describe("delete", () => {
    beforeEach(() => seed("players/pl1", player))

    it("allows the owner to delete", async () => {
      await assertSucceeds(deleteDoc(doc(owner(), "players/pl1")))
    })

    it("denies a random user from deleting", async () => {
      await assertFails(deleteDoc(doc(other(), "players/pl1")))
    })
  })
})

// ============================================================================
// /settings  (publicly readable, admin-only writes)
// ============================================================================

describe("/settings/{id}", () => {
  beforeEach(() =>
    seed("settings/app", { signupsEnabled: true }),
  )

  it("anyone can read settings (signup flow runs before auth)", async () => {
    await assertSucceeds(getDoc(doc(anon(), "settings/app")))
    await assertSucceeds(getDoc(doc(owner(), "settings/app")))
  })

  it("authenticated non-admins cannot write settings", async () => {
    await assertFails(
      updateDoc(doc(owner(), "settings/app"), { signupsEnabled: false }),
    )
  })

  it("plain admin (no superadmin claim) cannot write settings", async () => {
    // The /settings rule is gated on isSuperAdminClaim — admins without
    // the superadmin tier shouldn't be able to flip global toggles.
    await assertFails(
      updateDoc(doc(admin(), "settings/app"), { signupsEnabled: false }),
    )
  })

  it("superadmin can write settings", async () => {
    await assertSucceeds(
      updateDoc(doc(superAdmin(), "settings/app"), { signupsEnabled: false }),
    )
  })
})

// ============================================================================
// /users/{uid}  (per-user profile + role)
// ============================================================================

describe("/users/{uid}", () => {
  const baseProfile = {
    uid: OWNER,
    email: "alice@example.com",
    displayName: "Alice",
    preferredSide: "any",
    role: "player",
    createdAt: 0,
    updatedAt: 0,
  }

  describe("create", () => {
    it("self can create their own profile with role='player'", async () => {
      await assertSucceeds(
        setDoc(doc(owner(), `users/${OWNER}`), baseProfile),
      )
    })

    it("denies creating a profile with someone else's uid", async () => {
      await assertFails(
        setDoc(doc(owner(), `users/${OTHER}`), { ...baseProfile, uid: OTHER }),
      )
    })

    it("denies creating with role='admin' without a matching invite", async () => {
      // No invite exists for this email → can't self-promote to admin.
      await assertFails(
        setDoc(doc(owner(), `users/${OWNER}`), { ...baseProfile, role: "admin" }),
      )
    })

    it("allows creating with role='admin' when a matching adminInvite exists", async () => {
      // Seed an invite for this user's normalized email. The rule reads
      // request.auth.token.email.lower(), so we sign in with that exact email.
      const email = "invited@example.com"
      await seed(`adminInvites/${email}`, { email, createdAt: 0 })
      const profile = {
        ...baseProfile,
        uid: OWNER,
        email,
        role: "admin",
      }
      await assertSucceeds(
        setDoc(doc(authedAs(OWNER, email), `users/${OWNER}`), profile),
      )
    })

    it("legacy admin claim lets the user create with role='admin' (no invite needed)", async () => {
      const adminUid = "uid-legacy-admin"
      const ctx = env
        .authenticatedContext(adminUid, { admin: true })
        .firestore()
      await assertSucceeds(
        setDoc(doc(ctx, `users/${adminUid}`), {
          ...baseProfile,
          uid: adminUid,
          role: "admin",
        }),
      )
    })

    it("denies create where data.uid does not match the doc id", async () => {
      await assertFails(
        setDoc(doc(owner(), `users/${OWNER}`), { ...baseProfile, uid: OTHER }),
      )
    })

    it("denies unauthenticated create", async () => {
      await assertFails(setDoc(doc(anon(), `users/${OWNER}`), baseProfile))
    })
  })

  describe("read", () => {
    beforeEach(() => seed(`users/${OWNER}`, baseProfile))

    it("allows self to read their own profile", async () => {
      await assertSucceeds(getDoc(doc(owner(), `users/${OWNER}`)))
    })

    it("denies another user from reading", async () => {
      await assertFails(getDoc(doc(other(), `users/${OWNER}`)))
    })

    it("allows any admin to read (admin tier renders user lists)", async () => {
      await assertSucceeds(getDoc(doc(admin(), `users/${OWNER}`)))
    })

    it("denies unauthenticated reads", async () => {
      await assertFails(getDoc(doc(anon(), `users/${OWNER}`)))
    })
  })

  describe("update", () => {
    beforeEach(() => seed(`users/${OWNER}`, baseProfile))

    it("self can update mirrored fields without touching role", async () => {
      await assertSucceeds(
        updateDoc(doc(owner(), `users/${OWNER}`), { displayName: "Alice M." }),
      )
    })

    it("self cannot promote themselves to admin", async () => {
      await assertFails(
        updateDoc(doc(owner(), `users/${OWNER}`), { role: "admin" }),
      )
    })

    it("self cannot promote themselves to superadmin", async () => {
      await assertFails(
        updateDoc(doc(owner(), `users/${OWNER}`), { role: "superadmin" }),
      )
    })

    it("another user cannot modify this profile at all", async () => {
      await assertFails(
        updateDoc(doc(other(), `users/${OWNER}`), { displayName: "Hack" }),
      )
    })

    it("plain admin (claim only) cannot change role — that's superadmin-only", async () => {
      await assertFails(
        updateDoc(doc(admin(), `users/${OWNER}`), { role: "admin" }),
      )
    })

    it("superadmin can change any user's role", async () => {
      await assertSucceeds(
        updateDoc(doc(superAdmin(), `users/${OWNER}`), { role: "admin" }),
      )
    })
  })

  describe("delete", () => {
    beforeEach(() => seed(`users/${OWNER}`, baseProfile))

    it("allows self to delete (account-deletion flow)", async () => {
      await assertSucceeds(deleteDoc(doc(owner(), `users/${OWNER}`)))
    })

    it("denies another user from deleting", async () => {
      await assertFails(deleteDoc(doc(other(), `users/${OWNER}`)))
    })

    it("admin cannot delete user profiles (deletion is owner-only)", async () => {
      // Even admins can't delete /users/{uid} — that's a self-only action.
      await assertFails(deleteDoc(doc(admin(), `users/${OWNER}`)))
    })
  })
})

// ============================================================================
// /groups/{id}  (owner-scoped labels that organize pozos)
// ============================================================================

describe("/groups/{id}", () => {
  const group = {
    id: "g1",
    ownerId: OWNER,
    name: "Lunes",
    nameLower: "lunes",
    createdAt: 0,
    updatedAt: 0,
  }

  describe("create", () => {
    it("allows the owner to create a group with their own uid as ownerId", async () => {
      await assertSucceeds(setDoc(doc(owner(), "groups/g1"), group))
    })

    it("denies creating with someone else's uid as ownerId", async () => {
      await assertFails(
        setDoc(doc(owner(), "groups/g1"), { ...group, ownerId: OTHER }),
      )
    })

    it("denies unauthenticated create", async () => {
      await assertFails(setDoc(doc(anon(), "groups/g1"), group))
    })
  })

  describe("read", () => {
    beforeEach(() => seed("groups/g1", group))

    it("allows the owner to read their group", async () => {
      await assertSucceeds(getDoc(doc(owner(), "groups/g1")))
    })

    it("denies another authenticated user from reading", async () => {
      await assertFails(getDoc(doc(other(), "groups/g1")))
    })

    it("allows admin to read any group", async () => {
      await assertSucceeds(getDoc(doc(admin(), "groups/g1")))
    })

    it("denies unauthenticated reads", async () => {
      await assertFails(getDoc(doc(anon(), "groups/g1")))
    })
  })

  describe("update", () => {
    beforeEach(() => seed("groups/g1", group))

    it("owner can rename their group", async () => {
      await assertSucceeds(
        updateDoc(doc(owner(), "groups/g1"), { name: "Lunes PM", nameLower: "lunes pm" }),
      )
    })

    it("owner cannot transfer ownership to another user", async () => {
      await assertFails(
        updateDoc(doc(owner(), "groups/g1"), { ownerId: OTHER }),
      )
    })

    it("admin can update a group but ownerId stays fixed", async () => {
      await assertSucceeds(
        updateDoc(doc(admin(), "groups/g1"), { name: "Admin tagged" }),
      )
      await assertFails(
        updateDoc(doc(admin(), "groups/g1"), { ownerId: OTHER }),
      )
    })

    it("a random user cannot update a group they don't own", async () => {
      await assertFails(updateDoc(doc(other(), "groups/g1"), { name: "Hack" }))
    })
  })

  describe("delete", () => {
    beforeEach(() => seed("groups/g1", group))

    it("owner can delete their group", async () => {
      await assertSucceeds(deleteDoc(doc(owner(), "groups/g1")))
    })

    it("admin can delete any group", async () => {
      await assertSucceeds(deleteDoc(doc(admin(), "groups/g1")))
    })

    it("random user cannot delete", async () => {
      await assertFails(deleteDoc(doc(other(), "groups/g1")))
    })
  })
})

// ============================================================================
// SECURITY HARDENING TESTS — email verification, /mail lockdown,
// player-claim hasOnly, size caps. Added after the security audit.
// ============================================================================

// ============================================================================
// /classes
// ============================================================================

describe("/classes/{id}", () => {
  // Classes are an admin-tier tool, so the fixture is owned by the admin
  // context rather than the plain OWNER used by the other collections.
  const clase = {
    id: "cl1",
    ownerId: ADMIN,
    startsAt: 1_800_000_000_000,
    durationMin: 60,
    students: [{ id: "pl1", name: "Juan" }],
    packageId: "pkg1",
    packageType: "pack5",
    sessionIndex: 2,
    sessionCount: 5,
    status: "scheduled",
    location: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  }

  describe("create", () => {
    it("allows an admin to create a class they own", async () => {
      await assertSucceeds(setDoc(doc(admin(), "classes/cl1"), clase))
    })

    it("denies a non-admin, even for a class they'd own", async () => {
      await assertFails(
        setDoc(doc(owner(), "classes/cl1"), { ...clase, ownerId: OWNER }),
      )
    })

    it("denies an admin from creating a class owned by someone else", async () => {
      await assertFails(
        setDoc(doc(admin(), "classes/cl1"), { ...clase, ownerId: OTHER }),
      )
    })

    it("denies a class with no students or more than four", async () => {
      await assertFails(
        setDoc(doc(admin(), "classes/cl1"), { ...clase, students: [] }),
      )
      await assertFails(
        setDoc(doc(admin(), "classes/cl1"), {
          ...clase,
          students: Array.from({ length: 5 }, (_, i) => ({
            id: `pl${i}`,
            name: `Alumno ${i}`,
          })),
        }),
      )
    })

    it("denies an unknown status or a nonsensical duration", async () => {
      await assertFails(
        setDoc(doc(admin(), "classes/cl1"), { ...clase, status: "paid" }),
      )
      await assertFails(
        setDoc(doc(admin(), "classes/cl1"), { ...clase, durationMin: 0 }),
      )
    })

    it("denies unauthenticated create", async () => {
      await assertFails(setDoc(doc(anon(), "classes/cl1"), clase))
    })
  })

  describe("read", () => {
    beforeEach(() => seed("classes/cl1", clase))

    it("allows any admin to read", async () => {
      await assertSucceeds(getDoc(doc(admin(), "classes/cl1")))
    })

    it("allows a demoted owner to still read their own class", async () => {
      await seed("classes/cl2", { ...clase, id: "cl2", ownerId: OWNER })
      await assertSucceeds(getDoc(doc(owner(), "classes/cl2")))
    })

    it("denies a cliente reading someone else's class", async () => {
      await assertFails(getDoc(doc(other(), "classes/cl1")))
    })

    it("denies unauthenticated reads", async () => {
      await assertFails(getDoc(doc(anon(), "classes/cl1")))
    })
  })

  describe("update", () => {
    beforeEach(() => seed("classes/cl1", clase))

    it("allows an admin to reschedule", async () => {
      await assertSucceeds(
        updateDoc(doc(admin(), "classes/cl1"), {
          startsAt: 1_800_003_600_000,
          status: "done",
        }),
      )
    })

    it("denies moving the class to another owner or package", async () => {
      await assertFails(updateDoc(doc(admin(), "classes/cl1"), { ownerId: OTHER }))
      await assertFails(
        updateDoc(doc(admin(), "classes/cl1"), { packageId: "pkg2" }),
      )
    })

    it("keeps the student cap on update", async () => {
      await assertFails(
        updateDoc(doc(admin(), "classes/cl1"), {
          students: Array.from({ length: 5 }, (_, i) => ({
            id: `pl${i}`,
            name: `Alumno ${i}`,
          })),
        }),
      )
    })

    it("denies a non-admin from updating", async () => {
      await assertFails(
        updateDoc(doc(other(), "classes/cl1"), { status: "cancelled" }),
      )
    })
  })

  describe("delete", () => {
    beforeEach(() => seed("classes/cl1", clase))

    it("allows an admin to delete", async () => {
      await assertSucceeds(deleteDoc(doc(admin(), "classes/cl1")))
    })

    it("allows the owner to delete their own class", async () => {
      await seed("classes/cl2", { ...clase, id: "cl2", ownerId: OWNER })
      await assertSucceeds(deleteDoc(doc(owner(), "classes/cl2")))
    })

    it("denies anyone else from deleting", async () => {
      await assertFails(deleteDoc(doc(other(), "classes/cl1")))
    })
  })
})

describe("security: email_verified gates", () => {
  it("rejects /users create with role='admin' when email is NOT verified", async () => {
    // Setup: there IS a matching invite, BUT the user's email isn't verified.
    // This is the exact attacker path: register an unverified account using
    // an email we know was invited, try to consume the invite.
    const email = "invited@example.com"
    await seed(`adminInvites/${email}`, { email, createdAt: 0 })
    await assertFails(
      setDoc(
        doc(authedAs(OWNER, email, { verified: false }), `users/${OWNER}`),
        {
          uid: OWNER,
          email,
          displayName: "Attacker",
          preferredSide: "any",
          role: "admin",
          createdAt: 0,
          updatedAt: 0,
        },
      ),
    )
  })

  it("rejects /adminInvites self-read when email is NOT verified", async () => {
    const email = "invited@example.com"
    await seed(`adminInvites/${email}`, { email, createdAt: 0 })
    await assertFails(
      getDoc(doc(authedAs(OWNER, email, { verified: false }), `adminInvites/${email}`)),
    )
  })

  it("rejects /adminInvites self-delete when email is NOT verified", async () => {
    const email = "invited@example.com"
    await seed(`adminInvites/${email}`, { email, createdAt: 0 })
    await assertFails(
      deleteDoc(doc(authedAs(OWNER, email, { verified: false }), `adminInvites/${email}`)),
    )
  })

  it("rejects /players claim path when email is NOT verified", async () => {
    // Seed an unclaimed player invite for `invitee@example.com`.
    const invitedEmail = "invitee@example.com"
    await seed("players/pl-claim", {
      id: "pl-claim",
      ownerId: OWNER,
      name: "Ana",
      nameLower: "ana",
      linkedUid: null,
      invitedEmail,
      invitedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    })
    // Attacker logs in with the matching email but not verified.
    await assertFails(
      updateDoc(
        doc(
          authedAs("attacker-uid", invitedEmail, { verified: false }),
          "players/pl-claim",
        ),
        { linkedUid: "attacker-uid", invitedAt: null },
      ),
    )
  })

  it("verified email CAN consume the admin invite (positive control)", async () => {
    // Same as the negative cases but with email_verified=true — should
    // succeed. Locks in the happy path so we know the rule isn't simply
    // broken for everyone.
    const email = "invited@example.com"
    await seed(`adminInvites/${email}`, { email, createdAt: 0 })
    await assertSucceeds(
      setDoc(doc(authedAs(OWNER, email), `users/${OWNER}`), {
        uid: OWNER,
        email,
        displayName: "Real Invitee",
        preferredSide: "any",
        role: "admin",
        createdAt: 0,
        updatedAt: 0,
      }),
    )
  })
})

describe("security: /mail queue lockdown", () => {
  // Common mail body — the Trigger Email extension cares about `to` and
  // `message`, the rule cares about `_meta`.
  const mailBody = {
    to: "someone@example.com",
    message: { subject: "hi", html: "<p>hi</p>" },
  }

  it("rejects mail without _meta (the legacy spam path)", async () => {
    await assertFails(setDoc(doc(owner(), "mail/m1"), mailBody))
  })

  it("rejects mail whose _meta.ownerId doesn't match auth.uid (impersonation)", async () => {
    await assertFails(
      setDoc(doc(owner(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: OTHER, kind: "player-invite" },
      }),
    )
  })

  it("rejects mail with an unknown _meta.kind", async () => {
    await assertFails(
      setDoc(doc(owner(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: OWNER, kind: "newsletter" },
      }),
    )
  })

  it("allows player-invite mail from any authenticated user with valid _meta", async () => {
    await assertSucceeds(
      setDoc(doc(owner(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: OWNER, kind: "player-invite" },
      }),
    )
  })

  it("rejects admin-invite mail from a non-superadmin user", async () => {
    // Regular auth user (not even admin claim) trying to mint an admin invite.
    await assertFails(
      setDoc(doc(owner(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: OWNER, kind: "admin-invite" },
      }),
    )
  })

  it("rejects admin-invite mail from a plain admin (not superadmin)", async () => {
    // `admin: true` claim doesn't qualify — only `superadmin: true` does.
    await assertFails(
      setDoc(doc(admin(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: ADMIN, kind: "admin-invite" },
      }),
    )
  })

  it("allows admin-invite mail from a superadmin", async () => {
    await assertSucceeds(
      setDoc(doc(superAdmin(), "mail/m1"), {
        ...mailBody,
        _meta: { ownerId: ADMIN, kind: "admin-invite" },
      }),
    )
  })

  it("denies reading any mail doc (extension uses admin SDK)", async () => {
    await seed("mail/m1", {
      ...mailBody,
      _meta: { ownerId: OWNER, kind: "player-invite" },
    })
    await assertFails(getDoc(doc(owner(), "mail/m1")))
    await assertFails(getDoc(doc(superAdmin(), "mail/m1")))
  })
})

describe("security: size caps on user-writable strings/lists", () => {
  const longString = "x".repeat(100)

  it("rejects /pozos create with name longer than 80 chars", async () => {
    await assertFails(
      setDoc(doc(owner(), "pozos/p1"), {
        id: "p1",
        ownerId: OWNER,
        name: longString,
        createdAt: 0,
        status: "draft",
        config: {},
        players: [],
        matches: [],
      }),
    )
  })

  it("rejects /pozos create with players list larger than 64 entries", async () => {
    const players = Array.from({ length: 65 }, (_, i) => ({
      id: `p${i}`,
      name: `Player ${i}`,
    }))
    await assertFails(
      setDoc(doc(owner(), "pozos/p1"), {
        id: "p1",
        ownerId: OWNER,
        name: "Pozo",
        createdAt: 0,
        status: "draft",
        config: {},
        players,
        matches: [],
      }),
    )
  })

  it("rejects /players create with name longer than 80 chars", async () => {
    await assertFails(
      setDoc(doc(owner(), "players/pl1"), {
        id: "pl1",
        ownerId: OWNER,
        name: longString,
        nameLower: longString.toLowerCase(),
        linkedUid: null,
        invitedEmail: null,
        invitedAt: null,
        createdAt: 0,
        updatedAt: 0,
      }),
    )
  })

  it("rejects /groups create with name longer than 80 chars", async () => {
    await assertFails(
      setDoc(doc(owner(), "groups/g1"), {
        id: "g1",
        ownerId: OWNER,
        name: longString,
        nameLower: longString.toLowerCase(),
        createdAt: 0,
        updatedAt: 0,
      }),
    )
  })

  it("rejects /pozos create where players is not a list (type confusion)", async () => {
    await assertFails(
      setDoc(doc(owner(), "pozos/p1"), {
        id: "p1",
        ownerId: OWNER,
        name: "Pozo",
        createdAt: 0,
        status: "draft",
        config: {},
        players: "not-a-list" as unknown as never,
        matches: [],
      }),
    )
  })
})

describe("security: /players claim path is locked to specific keys", () => {
  const invitedEmail = "claimer@example.com"
  const CLAIMER_UID = "uid-claimer"
  const seededPlayer = {
    id: "pl-claim",
    ownerId: OWNER,
    name: "Ana",
    nameLower: "ana",
    linkedUid: null,
    invitedEmail,
    invitedAt: 0,
    createdAt: 0,
    updatedAt: 0,
  }

  beforeEach(() => seed("players/pl-claim", seededPlayer))

  it("allows the legitimate claim (linkedUid + invitedAt + updatedAt only)", async () => {
    await assertSucceeds(
      updateDoc(
        doc(authedAs(CLAIMER_UID, invitedEmail), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: null,
          updatedAt: 1,
        },
      ),
    )
  })

  it("rejects a claim that also rewrites `name` (corruption attempt)", async () => {
    await assertFails(
      updateDoc(
        doc(authedAs(CLAIMER_UID, invitedEmail), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: null,
          name: "Pwned",
        },
      ),
    )
  })

  it("rejects a claim that adds an arbitrary new field", async () => {
    await assertFails(
      updateDoc(
        doc(authedAs(CLAIMER_UID, invitedEmail), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: null,
          isAdmin: true,
        },
      ),
    )
  })

  it("rejects a claim that tries to keep invitedAt populated", async () => {
    // The claim path requires invitedAt to be set to null (claimed = no
    // longer "waiting on invitee").
    await assertFails(
      updateDoc(
        doc(authedAs(CLAIMER_UID, invitedEmail), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: Date.now(), // attacker tries to keep "invited" state
        },
      ),
    )
  })

  it("rejects a claim on a record already linked to someone else", async () => {
    // Re-seed with linkedUid already set — the claim path requires
    // resource.data.linkedUid == null.
    await seed("players/pl-claim", { ...seededPlayer, linkedUid: "someone-else" })
    await assertFails(
      updateDoc(
        doc(authedAs(CLAIMER_UID, invitedEmail), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: null,
        },
      ),
    )
  })

  it("rejects a claim where the auth user's email doesn't match invitedEmail", async () => {
    // Random authed user (correct verified=true via default) but with the
    // WRONG email — shouldn't be able to claim someone else's invite.
    await assertFails(
      updateDoc(
        doc(authedAs(CLAIMER_UID, "wrong@example.com"), "players/pl-claim"),
        {
          linkedUid: CLAIMER_UID,
          invitedAt: null,
        },
      ),
    )
  })
})

// ============================================================================
// default deny — anything else is locked down regardless of auth state
// ============================================================================

describe("default deny", () => {
  it("denies reading arbitrary unknown collections (authenticated)", async () => {
    await assertFails(getDoc(doc(owner(), "secrets/foo")))
  })

  it("denies writing arbitrary unknown collections (authenticated)", async () => {
    await assertFails(setDoc(doc(owner(), "secrets/foo"), { x: 1 }))
  })

  it("denies admin too on unknown collections", async () => {
    // Admin override is opt-in per resource; the default-deny tail catches
    // anything we didn't explicitly allow.
    await assertFails(setDoc(doc(admin(), "secrets/foo"), { x: 1 }))
  })

  it("denies unauthenticated reads", async () => {
    await assertFails(getDoc(doc(anon(), "secrets/foo")))
  })
})
