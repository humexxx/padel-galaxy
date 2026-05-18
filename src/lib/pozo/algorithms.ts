import type { Match, Pair, PairingAlgorithm, Player, Pozo } from "./types"

const PARTNER_REPEAT_PENALTY = 1000
const PARTNER_REPEAT_SOFT = 4
const OPPONENT_REPEAT_PENALTY = 10
const SKILL_GAP_WEIGHT = 5
const FOURSOME_REPEAT_PENALTY = 500

type Combination = {
  teamA: Pair
  teamB: Pair
}

function pairKey(pair: Pair): string {
  return [pair.playerA, pair.playerB].sort().join("|")
}

function pairKeyIds(a: string, b: string): string {
  return [a, b].sort().join("|")
}

function matchupKey(a: string, b: string): string {
  return [a, b].sort().join("~")
}

function foursomeKey(ids: string[]): string {
  return [...ids].sort().join("#")
}

type History = {
  partnerCount: Map<string, number>
  opponentCount: Map<string, number>
  foursomeCount: Map<string, number>
  matchesPlayed: Map<string, number>
  wins: Map<string, number>
  gamesDiff: Map<string, number>
}

export function buildHistory(matches: Match[], players: Player[]): History {
  const partnerCount = new Map<string, number>()
  const opponentCount = new Map<string, number>()
  const foursomeCount = new Map<string, number>()
  const matchesPlayed = new Map<string, number>()
  const wins = new Map<string, number>()
  const gamesDiff = new Map<string, number>()

  for (const p of players) {
    matchesPlayed.set(p.id, 0)
    wins.set(p.id, 0)
    gamesDiff.set(p.id, 0)
  }

  for (const match of matches) {
    const teamAIds = [match.teamA.playerA, match.teamA.playerB]
    const teamBIds = [match.teamB.playerA, match.teamB.playerB]
    const fourKey = foursomeKey([...teamAIds, ...teamBIds])
    foursomeCount.set(fourKey, (foursomeCount.get(fourKey) ?? 0) + 1)

    partnerCount.set(pairKey(match.teamA), (partnerCount.get(pairKey(match.teamA)) ?? 0) + 1)
    partnerCount.set(pairKey(match.teamB), (partnerCount.get(pairKey(match.teamB)) ?? 0) + 1)
    for (const a of teamAIds) for (const b of teamBIds) {
      const k = matchupKey(a, b)
      opponentCount.set(k, (opponentCount.get(k) ?? 0) + 1)
    }
    for (const id of [...teamAIds, ...teamBIds]) {
      matchesPlayed.set(id, (matchesPlayed.get(id) ?? 0) + 1)
    }

    if (match.gamesA === null || match.gamesB === null) continue
    const diff = match.gamesA - match.gamesB
    for (const id of teamAIds) {
      gamesDiff.set(id, (gamesDiff.get(id) ?? 0) + diff)
      if (diff > 0) wins.set(id, (wins.get(id) ?? 0) + 1)
    }
    for (const id of teamBIds) {
      gamesDiff.set(id, (gamesDiff.get(id) ?? 0) - diff)
      if (diff < 0) wins.set(id, (wins.get(id) ?? 0) + 1)
    }
  }

  return { partnerCount, opponentCount, foursomeCount, matchesPlayed, wins, gamesDiff }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function strengthOf(playerId: string, history: History): number {
  return (history.wins.get(playerId) ?? 0) + (history.gamesDiff.get(playerId) ?? 0) / 6
}

/**
 * Canonical round-robin (circle method).
 * For even N: returns N-1 rounds, each with N/2 disjoint pairs covering all players.
 * Every pair of players partners together exactly once across the schedule.
 */
function canonicalRoundRobin(players: Player[]): Pair[][] {
  const n = players.length
  if (n < 2 || n % 2 !== 0) return []
  const ids = players.map((p) => p.id)
  const rounds: Pair[][] = []
  // Anchor ids[0], rotate ids[1..n-1]
  const fixed = ids[0]
  const rotating = ids.slice(1)
  const rotN = rotating.length
  for (let r = 0; r < n - 1; r++) {
    const pairs: Pair[] = []
    pairs.push({ playerA: fixed, playerB: rotating[r % rotN] })
    for (let i = 1; i < n / 2; i++) {
      const aIdx = (r + i) % rotN
      const bIdx = (r - i + rotN) % rotN
      pairs.push({ playerA: rotating[aIdx], playerB: rotating[bIdx] })
    }
    rounds.push(pairs)
  }
  return rounds
}

/**
 * Backtracking: find a perfect pairing of `pool` honoring history & algorithm.
 * Uses ranked candidates (by combined penalty) to prefer good pairings.
 */
function findPairing(
  pool: Player[],
  history: History,
  algorithm: PairingAlgorithm,
  allowRepeatPairs: boolean,
): Pair[] | null {
  if (pool.length % 2 !== 0) return null
  const used = new Set<string>()
  const result: Pair[] = []

  function candidateScore(a: string, b: string): number {
    const repeats = history.partnerCount.get(pairKeyIds(a, b)) ?? 0
    let s = allowRepeatPairs ? repeats * PARTNER_REPEAT_SOFT : repeats * PARTNER_REPEAT_PENALTY
    if (algorithm === "snake") {
      // Prefer "strong + weak" pairs (maximize strength differential)
      const diff = Math.abs(strengthOf(a, history) - strengthOf(b, history))
      s -= diff * 2
    } else if (algorithm === "balanced") {
      // Prefer similar-strength pairs (we'll balance teams later by grouping)
      const diff = Math.abs(strengthOf(a, history) - strengthOf(b, history))
      s += diff * 0.5
    }
    return s
  }

  function pickNext(): Player | null {
    for (const p of pool) if (!used.has(p.id)) return p
    return null
  }

  function backtrack(): boolean {
    const next = pickNext()
    if (!next) return true
    used.add(next.id)
    const candidates = pool
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: candidateScore(next.id, p.id) }))
      .sort((a, b) => a.score - b.score)

    for (const { p } of candidates) {
      const repeats = history.partnerCount.get(pairKeyIds(next.id, p.id)) ?? 0
      if (!allowRepeatPairs && repeats > 0) continue
      used.add(p.id)
      result.push({ playerA: next.id, playerB: p.id })
      if (backtrack()) return true
      result.pop()
      used.delete(p.id)
    }
    used.delete(next.id)
    return false
  }

  return backtrack() ? result : null
}

/**
 * Fallback when no zero-repeat pairing exists: minimize total repeats greedily.
 */
function findPairingMinRepeats(pool: Player[], history: History): Pair[] {
  const result: Pair[] = []
  const used = new Set<string>()
  while (used.size < pool.length) {
    const remaining = pool.filter((p) => !used.has(p.id))
    if (remaining.length < 2) break
    const [first, ...rest] = remaining
    const partner = rest
      .map((p) => ({ p, r: history.partnerCount.get(pairKeyIds(first.id, p.id)) ?? 0 }))
      .sort((a, b) => a.r - b.r)[0].p
    result.push({ playerA: first.id, playerB: partner.id })
    used.add(first.id)
    used.add(partner.id)
  }
  return result
}

/**
 * Group the round's pairs into matches (2 pairs per match) minimizing
 * opponent repeats and team-strength imbalance.
 */
function groupPairsIntoMatches(
  pairs: Pair[],
  history: History,
  algorithm: PairingAlgorithm,
): Combination[] {
  if (pairs.length % 2 !== 0 || pairs.length === 0) return []

  function pairStrength(p: Pair) {
    return strengthOf(p.playerA, history) + strengthOf(p.playerB, history)
  }

  function matchScore(a: Pair, b: Pair): number {
    let score = 0
    const aIds = [a.playerA, a.playerB]
    const bIds = [b.playerA, b.playerB]
    const fKey = foursomeKey([...aIds, ...bIds])
    const foursomeRepeats = history.foursomeCount.get(fKey) ?? 0
    score += foursomeRepeats * FOURSOME_REPEAT_PENALTY
    for (const ai of aIds) {
      for (const bi of bIds) {
        score += (history.opponentCount.get(matchupKey(ai, bi)) ?? 0) * OPPONENT_REPEAT_PENALTY
      }
    }
    if (algorithm === "balanced") {
      score += Math.abs(pairStrength(a) - pairStrength(b)) * SKILL_GAP_WEIGHT
    }
    return score
  }

  let best: Combination[] | null = null
  let bestScore = Infinity

  function backtrack(remaining: Pair[], current: Combination[], currentScore: number) {
    if (remaining.length === 0) {
      if (currentScore < bestScore) {
        bestScore = currentScore
        best = current.map((c) => ({ ...c }))
      }
      return
    }
    if (currentScore >= bestScore) return
    const first = remaining[0]
    for (let i = 1; i < remaining.length; i++) {
      const other = remaining[i]
      const score = matchScore(first, other)
      const next = remaining.filter((_, idx) => idx !== 0 && idx !== i)
      current.push({ teamA: first, teamB: other })
      backtrack(next, current, currentScore + score)
      current.pop()
    }
  }

  backtrack(pairs, [], 0)
  if (best) return best
  const fallback: Combination[] = []
  for (let i = 0; i < pairs.length / 2; i++) {
    fallback.push({ teamA: pairs[i * 2], teamB: pairs[i * 2 + 1] })
  }
  return fallback
}

/**
 * Choose players for this round. If we have more players than slots, prefer
 * those with the fewest matches played (round-robin rotation).
 */
function pickPlayersForRound(
  players: Player[],
  history: History,
  courts: number,
  algorithm: PairingAlgorithm,
): Player[] {
  const needed = courts * 4
  if (players.length <= needed) return [...players]
  return [...players]
    .sort((a, b) => {
      const restA = history.matchesPlayed.get(a.id) ?? 0
      const restB = history.matchesPlayed.get(b.id) ?? 0
      if (restA !== restB) return restA - restB
      if (algorithm === "balanced") {
        return strengthOf(b.id, history) - strengthOf(a.id, history)
      }
      return Math.random() - 0.5
    })
    .slice(0, needed)
}

/**
 * Plan a single round: produce pairings (honoring no-repeat if requested)
 * and group them into matches per algorithm preference.
 */
function planRound(
  pool: Player[],
  history: History,
  algorithm: PairingAlgorithm,
  allowRepeatPairs: boolean,
  prebuiltPairs?: Pair[],
): Combination[] {
  if (prebuiltPairs) {
    return groupPairsIntoMatches(prebuiltPairs, history, algorithm)
  }

  const attempts = algorithm === "random" ? 12 : 60
  let bestRound: Combination[] | null = null
  let bestScore = Infinity

  for (let attempt = 0; attempt < attempts; attempt++) {
    const shuffled = attempt === 0 ? pool : shuffle(pool)
    const pairs =
      findPairing(shuffled, history, algorithm, allowRepeatPairs) ??
      findPairingMinRepeats(shuffled, history)
    const matches = groupPairsIntoMatches(pairs, history, algorithm)

    let score = 0
    for (const m of matches) {
      const repA = history.partnerCount.get(pairKey(m.teamA)) ?? 0
      const repB = history.partnerCount.get(pairKey(m.teamB)) ?? 0
      score += allowRepeatPairs
        ? (repA + repB) * PARTNER_REPEAT_SOFT
        : (repA + repB) * PARTNER_REPEAT_PENALTY
      const aIds = [m.teamA.playerA, m.teamA.playerB]
      const bIds = [m.teamB.playerA, m.teamB.playerB]
      const fKey = foursomeKey([...aIds, ...bIds])
      score += (history.foursomeCount.get(fKey) ?? 0) * FOURSOME_REPEAT_PENALTY
      for (const a of aIds) {
        for (const b of bIds) {
          score += (history.opponentCount.get(matchupKey(a, b)) ?? 0) * OPPONENT_REPEAT_PENALTY
        }
      }
      if (algorithm === "balanced") {
        const sA = strengthOf(m.teamA.playerA, history) + strengthOf(m.teamA.playerB, history)
        const sB = strengthOf(m.teamB.playerA, history) + strengthOf(m.teamB.playerB, history)
        score += Math.abs(sA - sB) * SKILL_GAP_WEIGHT
      }
    }

    if (score < bestScore) {
      bestScore = score
      bestRound = matches
      if (score === 0) break
    }
  }

  return bestRound ?? []
}

export function computeTotalRounds(playerCount: number, courts: number, matchesPerPlayer: number): number {
  if (playerCount < 4 || courts < 1) return 0
  const playersPerRound = Math.min(playerCount, courts * 4)
  if (playersPerRound === 0) return 0
  const totalPlayerSlots = matchesPerPlayer * playerCount
  return Math.ceil(totalPlayerSlots / playersPerRound)
}

export function defaultMatchesPerPlayer(playerCount: number, courts: number): number {
  if (playerCount < 4) return 0
  if (playerCount <= courts * 4) return Math.max(1, playerCount - 1)
  return Math.max(1, Math.floor((playerCount - 1) / 2))
}

/**
 * Determine whether to use the canonical round-robin schedule.
 * Conditions: players exactly fill courts (no rotation), allowRepeatPairs is off,
 * and round index is within the first N-1 rounds.
 */
function shouldUseCanonicalSchedule(pozo: Pozo): boolean {
  return (
    !pozo.config.allowRepeatPairs &&
    pozo.players.length === pozo.config.courts * 4 &&
    pozo.players.length % 2 === 0
  )
}

export function generateRound(pozo: Pozo, roundIndex: number): Match[] {
  const history = buildHistory(pozo.matches, pozo.players)
  const pool = pickPlayersForRound(
    pozo.players,
    history,
    pozo.config.courts,
    pozo.config.algorithm,
  )
  if (pool.length < 4) return []

  let combos: Combination[]
  if (shouldUseCanonicalSchedule(pozo)) {
    const allRounds = canonicalRoundRobin(pool)
    if (roundIndex < allRounds.length) {
      combos = planRound(pool, history, pozo.config.algorithm, pozo.config.allowRepeatPairs, allRounds[roundIndex])
    } else {
      combos = planRound(pool, history, pozo.config.algorithm, true)
    }
  } else {
    combos = planRound(pool, history, pozo.config.algorithm, pozo.config.allowRepeatPairs)
  }

  return combos.map((c, idx) => ({
    id: crypto.randomUUID(),
    round: roundIndex,
    court: idx + 1,
    teamA: c.teamA,
    teamB: c.teamB,
    gamesA: null,
    gamesB: null,
  }))
}
