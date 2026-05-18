import type { Match, Pair, PairingAlgorithm, Player, Pozo } from "./types"

const PARTNER_REPEAT_PENALTY = 100
const PARTNER_REPEAT_SOFT = 3
const OPPONENT_REPEAT_PENALTY = 8
const SKILL_GAP_WEIGHT = 4

type Combination = {
  teamA: Pair
  teamB: Pair
}

function teamCombinations(group: Player[]): Combination[] {
  if (group.length !== 4) return []
  const [p1, p2, p3, p4] = group
  return [
    { teamA: { playerA: p1.id, playerB: p2.id }, teamB: { playerA: p3.id, playerB: p4.id } },
    { teamA: { playerA: p1.id, playerB: p3.id }, teamB: { playerA: p2.id, playerB: p4.id } },
    { teamA: { playerA: p1.id, playerB: p4.id }, teamB: { playerA: p2.id, playerB: p3.id } },
  ]
}

function pairKey(pair: Pair): string {
  return [pair.playerA, pair.playerB].sort().join("|")
}

function matchupKey(a: string, b: string): string {
  return [a, b].sort().join("~")
}

type History = {
  partnerCount: Map<string, number>
  opponentCount: Map<string, number>
  matchesPlayed: Map<string, number>
  wins: Map<string, number>
  gamesDiff: Map<string, number>
}

export function buildHistory(matches: Match[], players: Player[]): History {
  const partnerCount = new Map<string, number>()
  const opponentCount = new Map<string, number>()
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

  return { partnerCount, opponentCount, matchesPlayed, wins, gamesDiff }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function combinationsOfFour<T>(items: T[]): T[][] {
  const result: T[][] = []
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++)
      for (let c = b + 1; c < items.length; c++)
        for (let d = c + 1; d < items.length; d++)
          result.push([items[a], items[b], items[c], items[d]])
  return result
}

function strengthOf(playerId: string, history: History): number {
  return (history.wins.get(playerId) ?? 0) + (history.gamesDiff.get(playerId) ?? 0) / 6
}

function scoreCombination(
  combo: Combination,
  history: History,
  allowRepeatPairs: boolean,
  algorithm: PairingAlgorithm,
): number {
  let penalty = 0

  const repeatA = history.partnerCount.get(pairKey(combo.teamA)) ?? 0
  const repeatB = history.partnerCount.get(pairKey(combo.teamB)) ?? 0
  penalty += allowRepeatPairs
    ? (repeatA + repeatB) * PARTNER_REPEAT_SOFT
    : (repeatA + repeatB) * PARTNER_REPEAT_PENALTY

  const teamAIds = [combo.teamA.playerA, combo.teamA.playerB]
  const teamBIds = [combo.teamB.playerA, combo.teamB.playerB]
  for (const a of teamAIds) for (const b of teamBIds) {
    penalty += (history.opponentCount.get(matchupKey(a, b)) ?? 0) * OPPONENT_REPEAT_PENALTY
  }

  if (algorithm === "balanced") {
    const teamAStrength = strengthOf(combo.teamA.playerA, history) + strengthOf(combo.teamA.playerB, history)
    const teamBStrength = strengthOf(combo.teamB.playerA, history) + strengthOf(combo.teamB.playerB, history)
    penalty += Math.abs(teamAStrength - teamBStrength) * SKILL_GAP_WEIGHT
  }

  if (algorithm === "snake") {
    const ordered = [combo.teamA.playerA, combo.teamA.playerB, combo.teamB.playerA, combo.teamB.playerB]
      .map((id) => ({ id, s: strengthOf(id, history) }))
      .sort((a, b) => b.s - a.s)
    const topBottom = new Set([ordered[0].id, ordered[3].id])
    const teamAOnSnake =
      topBottom.has(combo.teamA.playerA) === topBottom.has(combo.teamA.playerB)
    if (!teamAOnSnake) penalty += 12
  }

  return penalty
}

function pickBestCombination(
  group: Player[],
  history: History,
  allowRepeatPairs: boolean,
  algorithm: PairingAlgorithm,
): Combination {
  const combos = teamCombinations(group)
  if (algorithm === "random") {
    return combos[Math.floor(Math.random() * combos.length)]
  }
  let best = combos[0]
  let bestScore = Infinity
  for (const combo of combos) {
    const s = scoreCombination(combo, history, allowRepeatPairs, algorithm)
    if (s < bestScore) {
      bestScore = s
      best = combo
    }
  }
  return best
}

function scoreGrouping(
  groups: Player[][],
  history: History,
  allowRepeatPairs: boolean,
  algorithm: PairingAlgorithm,
): number {
  let total = 0
  for (const group of groups) {
    if (group.length !== 4) continue
    const combos = teamCombinations(group)
    let best = Infinity
    for (const combo of combos) {
      const s = scoreCombination(combo, history, allowRepeatPairs, algorithm)
      if (s < best) best = s
    }
    total += best
  }
  return total
}

function partitionIntoCourts(
  pool: Player[],
  history: History,
  allowRepeatPairs: boolean,
  algorithm: PairingAlgorithm,
  courts: number,
): Player[][] {
  if (pool.length !== courts * 4) {
    const groups: Player[][] = []
    const shuffled = shuffle(pool)
    for (let i = 0; i < courts && (i + 1) * 4 <= shuffled.length; i++) {
      groups.push(shuffled.slice(i * 4, i * 4 + 4))
    }
    return groups
  }
  if (courts === 1) return [pool]

  const tries = algorithm === "random" ? 1 : Math.min(60, courts * 18)
  let bestGrouping: Player[][] = []
  let bestScore = Infinity
  for (let attempt = 0; attempt < tries; attempt++) {
    const shuffled = attempt === 0 ? pool : shuffle(pool)
    const groups: Player[][] = []
    for (let i = 0; i < courts; i++) {
      groups.push(shuffled.slice(i * 4, i * 4 + 4))
    }
    const score = scoreGrouping(groups, history, allowRepeatPairs, algorithm)
    if (score < bestScore) {
      bestScore = score
      bestGrouping = groups
    }
  }
  return bestGrouping
}

function pickPlayersForRound(
  players: Player[],
  history: History,
  courts: number,
  algorithm: PairingAlgorithm,
  allowRepeatPairs: boolean,
): Player[][] {
  const needed = courts * 4
  if (players.length < 4) return []

  const sortedByRest = [...players].sort((a, b) => {
    const restA = history.matchesPlayed.get(a.id) ?? 0
    const restB = history.matchesPlayed.get(b.id) ?? 0
    if (restA !== restB) return restA - restB
    return Math.random() - 0.5
  })

  const pool = sortedByRest.slice(0, Math.min(needed, players.length))

  if (algorithm === "balanced" && pool.length === needed) {
    const ranked = [...pool].sort((a, b) => strengthOf(b.id, history) - strengthOf(a.id, history))
    const groups: Player[][] = Array.from({ length: courts }, () => [])
    for (let i = 0; i < ranked.length; i++) {
      const courtIndex = Math.floor(i / 4)
      groups[courtIndex % courts].push(ranked[i])
    }
    return groups
  }

  return partitionIntoCourts(pool, history, allowRepeatPairs, algorithm, courts)
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

export function generateRound(pozo: Pozo, roundIndex: number): Match[] {
  const history = buildHistory(pozo.matches, pozo.players)
  const groups = pickPlayersForRound(
    pozo.players,
    history,
    pozo.config.courts,
    pozo.config.algorithm,
    pozo.config.allowRepeatPairs,
  )
  return groups
    .filter((g) => g.length === 4)
    .map((group, idx) => {
      const combo = pickBestCombination(
        group,
        history,
        pozo.config.allowRepeatPairs,
        pozo.config.algorithm,
      )
      return {
        id: crypto.randomUUID(),
        round: roundIndex,
        court: idx + 1,
        teamA: combo.teamA,
        teamB: combo.teamB,
        gamesA: null,
        gamesB: null,
      }
    })
}

export { combinationsOfFour }
