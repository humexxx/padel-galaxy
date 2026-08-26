import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

const COLLECTION = "classes"

/** A student slot on a class. Denormalized so the agenda renders without
 *  a /players read per row (names are edited rarely; the roster page is
 *  the source of truth if they diverge). */
export type ClassStudent = {
  id: string
  name: string
}

export type ClassPackageType = "individual" | "pack3" | "pack5"

export type ClassStatus = "scheduled" | "done" | "cancelled"

/** How the sessions of a multi-class package get laid out on the calendar. */
export type ClassCadence = "weekly" | "biweekly" | "daily"

/**
 * One scheduled lesson. A package of 3 or 5 classes is stored as 3 or 5
 * separate documents sharing a `packageId` — that way each session can be
 * moved, cancelled, or marked as taught on its own, which is what actually
 * happens when someone can't make it on a Tuesday.
 */
export type ClassRecord = {
  id: string
  ownerId: string
  /** Millis since epoch for the start of the class (local wall clock). */
  startsAt: number
  durationMin: number
  /** 1 to 4 students. */
  students: ClassStudent[]
  /** Groups the sessions bought together. Single classes get one too, so
   *  every class can be handled through the same code path. */
  packageId: string
  packageType: ClassPackageType
  /** 1-based position inside the package. */
  sessionIndex: number
  /** How many sessions the package has (1, 3 or 5). */
  sessionCount: number
  status: ClassStatus
  location: string | null
  notes: string | null
  createdAt: number
  updatedAt: number
}

export const MAX_STUDENTS = 4

export const SESSIONS_BY_PACKAGE: Record<ClassPackageType, number> = {
  individual: 1,
  pack3: 3,
  pack5: 5,
}

const CADENCE_DAYS: Record<ClassCadence, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
}

export const DEFAULT_DURATION_MIN = 60
export const DURATION_OPTIONS = [45, 60, 90, 120] as const

export const PACKAGE_OPTIONS: {
  value: ClassPackageType
  label: string
  description: string
}[] = [
  { value: "individual", label: "Individual", description: "1 clase" },
  { value: "pack3", label: "Pack de 3", description: "3 clases" },
  { value: "pack5", label: "Pack de 5", description: "5 clases" },
]

export const CADENCE_OPTIONS: { value: ClassCadence; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "daily", label: "Diaria" },
]

export function packageLabel(type: ClassPackageType): string {
  return PACKAGE_OPTIONS.find((o) => o.value === type)?.label ?? "Individual"
}

/** "Clase 2 de 5" — null for single classes, where it'd be noise. */
export function sessionLabel(record: ClassRecord): string | null {
  if (record.sessionCount <= 1) return null
  return `Clase ${record.sessionIndex} de ${record.sessionCount}`
}

export function classEndsAt(record: ClassRecord): number {
  return record.startsAt + record.durationMin * 60_000
}

// ---------------------------------------------------------------------------
// Date helpers
//
// Everything is local wall-clock: an 18:00 class is 18:00 for the organizer
// standing at the club, so sessions are stepped with `setDate` (which keeps
// the hour across a DST jump) rather than by adding fixed millis.
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

/** Local-time value for an `<input type="date">`. */
export function dateInputValue(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local-time value for an `<input type="time">`. */
export function timeInputValue(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Combine the two native input values into a local-time timestamp.
 * Returns NaN when either half is missing or malformed, so callers can
 * treat "user hasn't finished picking" and "invalid" the same way.
 */
export function toTimestamp(date: string, time: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const tm = /^(\d{2}):(\d{2})/.exec(time)
  if (!dm || !tm) return NaN
  const parsed = new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    0,
    0,
  )
  return parsed.getTime()
}

/** Start timestamps for every session of a package, first one included. */
export function buildSessionStarts(
  firstStartsAt: number,
  count: number,
  cadence: ClassCadence,
): number[] {
  const step = CADENCE_DAYS[cadence]
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const d = new Date(firstStartsAt)
    d.setDate(d.getDate() + i * step)
    return d.getTime()
  })
}

/**
 * Sensible first slot for a new class: the next full hour. Late-evening
 * picks roll over to 9 AM tomorrow rather than proposing a class at
 * midnight.
 */
export function defaultClassStart(now: number = Date.now()): number {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const hour = d.getHours()
  if (hour >= 23 || hour < 7) {
    // Only bump the day when we're still on the same evening — past
    // midnight the +1 hour already rolled it over for us.
    if (hour >= 23) d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  return d.getTime()
}

/** "26 ago" — compact enough for the multi-session preview line. */
export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })
}

/** Stable local-day key, used to bucket the agenda into day sections. */
export function dayKey(ts: number): string {
  return dateInputValue(ts)
}

export function formatTime(ts: number): string {
  return timeInputValue(ts)
}

/** "Hoy", "Mañana", "Ayer" or "jue 28 ago". */
export function formatDayHeading(ts: number, now: number = Date.now()): string {
  const diff = daysBetween(now, ts)
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Mañana"
  if (diff === -1) return "Ayer"
  return new Date(ts).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Whole local days from `from` to `to`, ignoring the time of day. */
function daysBetween(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** "Juan" · "Juan y Pedro" · "Juan, Pedro y Ana". */
export function studentsLabel(students: ClassStudent[]): string {
  const names = students.map((s) => s.name.trim()).filter(Boolean)
  if (names.length === 0) return "Sin alumnos"
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
}

/**
 * Still ahead of us: scheduled (not taught, not cancelled) and not finished
 * yet. A class stays in "Próximas" while it's being taught, which is exactly
 * when the organizer is most likely to have the app open.
 */
export function isUpcoming(record: ClassRecord, now: number): boolean {
  return record.status === "scheduled" && classEndsAt(record) > now
}

/**
 * Split the agenda in two: what's coming (soonest first) and everything
 * else — taught, cancelled, or simply past (most recent first).
 */
export function splitClasses(
  records: ClassRecord[],
  now: number,
): { upcoming: ClassRecord[]; past: ClassRecord[] } {
  const upcoming: ClassRecord[] = []
  const past: ClassRecord[] = []
  for (const r of records) {
    if (isUpcoming(r, now)) upcoming.push(r)
    else past.push(r)
  }
  upcoming.sort((a, b) => a.startsAt - b.startsAt)
  past.sort((a, b) => b.startsAt - a.startsAt)
  return { upcoming, past }
}

export type ClassDayGroup = {
  key: string
  /** Start of the first class that day — good enough to format the heading. */
  ts: number
  classes: ClassRecord[]
}

/** Bucket into day sections, preserving the order the list came in. */
export function groupByDay(records: ClassRecord[]): ClassDayGroup[] {
  const groups: ClassDayGroup[] = []
  const byKey = new Map<string, ClassDayGroup>()
  for (const r of records) {
    const key = dayKey(r.startsAt)
    let group = byKey.get(key)
    if (!group) {
      group = { key, ts: r.startsAt, classes: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.classes.push(r)
  }
  return groups
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

function classDoc(id: string) {
  return doc(db, COLLECTION, id)
}

export function newClassId(): string {
  return doc(collection(db, COLLECTION)).id
}

export function subscribeOwnerClasses(
  ownerId: string,
  onData: (records: ClassRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where("ownerId", "==", ownerId),
    orderBy("startsAt", "asc"),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ClassRecord)),
    onError,
  )
}

/**
 * Every class in the system. Rules allow `isAdmin()` to read any class doc,
 * but callers should still gate on `isSuperAdmin` — a regular admin only
 * cares about the agenda they organize.
 */
export function subscribeAllClasses(
  onData: (records: ClassRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("startsAt", "asc"))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ClassRecord)),
    onError,
  )
}

export type CreateClassPackageInput = {
  ownerId: string
  students: ClassStudent[]
  packageType: ClassPackageType
  /** Start of the FIRST session; the rest are derived from `cadence`. */
  firstStartsAt: number
  durationMin: number
  cadence: ClassCadence
  location?: string | null
  notes?: string | null
}

/**
 * Book a whole package at once. A pack of 5 lands on the agenda as five
 * scheduled classes so the organizer can see the commitment they just made;
 * each one is independently editable afterwards.
 */
export async function createClassPackage({
  ownerId,
  students,
  packageType,
  firstStartsAt,
  durationMin,
  cadence,
  location,
  notes,
}: CreateClassPackageInput): Promise<ClassRecord[]> {
  const sessionCount = SESSIONS_BY_PACKAGE[packageType]
  const starts = buildSessionStarts(firstStartsAt, sessionCount, cadence)
  const packageId = newClassId()
  const now = Date.now()

  const records: ClassRecord[] = starts.map((startsAt, i) => ({
    id: i === 0 ? packageId : newClassId(),
    ownerId,
    startsAt,
    durationMin,
    students: students.map((s) => ({ id: s.id, name: s.name.trim() })),
    packageId,
    packageType,
    sessionIndex: i + 1,
    sessionCount,
    status: "scheduled",
    location: location?.trim() || null,
    notes: notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }))

  const batch = writeBatch(db)
  for (const record of records) {
    batch.set(classDoc(record.id), {
      ...record,
      _createdAtServer: serverTimestamp(),
    })
  }
  await batch.commit()
  return records
}

export async function updateClass(
  id: string,
  patch: Partial<Omit<ClassRecord, "id" | "ownerId" | "packageId" | "createdAt">>,
): Promise<void> {
  await updateDoc(classDoc(id), { ...patch, updatedAt: Date.now() })
}

export async function setClassStatus(
  id: string,
  status: ClassStatus,
): Promise<void> {
  await updateClass(id, { status })
}

export async function deleteClass(id: string): Promise<void> {
  await deleteDoc(classDoc(id))
}

/**
 * Delete every session of a package. Queried rather than derived from the
 * caller's list so a sibling that hasn't reached the local snapshot yet
 * doesn't get orphaned.
 */
export async function deleteClassPackage(packageId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("packageId", "==", packageId)),
  )
  if (snap.empty) return 0
  const batch = writeBatch(db)
  for (const d of snap.docs) batch.delete(d.ref)
  await batch.commit()
  return snap.size
}
