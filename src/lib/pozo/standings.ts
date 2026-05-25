import type { Match, Player, PlayerStanding } from "./types"

const WIN_POINTS = 3
const TIE_POINTS = 1

export type StandingsSort = "games" | "points"

export const STANDINGS_SORT_LABELS: Record<StandingsSort, string> = {
  games: "Por games",
  points: "Por puntos",
}

export function computeStandings(players: Player[], matches: Match[]): PlayerStanding[] {
  const standings = new Map<string, PlayerStanding>()
  for (const p of players) {
    standings.set(p.id, {
      player: p,
      matchesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDiff: 0,
      matchesWon: 0,
      points: 0,
    })
  }

  for (const match of matches) {
    if (match.gamesA === null || match.gamesB === null) continue
    const teamAIds = [match.teamA.playerA, match.teamA.playerB]
    const teamBIds = [match.teamB.playerA, match.teamB.playerB]
    const ga = match.gamesA
    const gb = match.gamesB
    const aWon = ga > gb
    const tied = ga === gb

    for (const id of teamAIds) {
      const s = standings.get(id)
      if (!s) continue
      s.matchesPlayed += 1
      s.gamesWon += ga
      s.gamesLost += gb
      s.gamesDiff += ga - gb
      if (aWon) {
        s.matchesWon += 1
        s.points += WIN_POINTS
      } else if (tied) {
        s.points += TIE_POINTS
      }
    }
    for (const id of teamBIds) {
      const s = standings.get(id)
      if (!s) continue
      s.matchesPlayed += 1
      s.gamesWon += gb
      s.gamesLost += ga
      s.gamesDiff += gb - ga
      if (!aWon && !tied) {
        s.matchesWon += 1
        s.points += WIN_POINTS
      } else if (tied) {
        s.points += TIE_POINTS
      }
    }
  }

  return [...standings.values()]
}

/**
 * Sum of head-to-head deltas for `playerId` versus everyone in `others`.
 * +1 each time the player's team beats a team that contained someone in `others`.
 * -1 for the reverse. 0 on ties. Counts every "in-set opponent" separately
 * (so a match against 2 in-set opponents at once counts double).
 */
export function headToHeadScore(
  matches: Match[],
  playerId: string,
  others: Set<string>,
): number {
  let score = 0
  for (const m of matches) {
    if (m.gamesA === null || m.gamesB === null) continue
    const aIds = [m.teamA.playerA, m.teamA.playerB]
    const bIds = [m.teamB.playerA, m.teamB.playerB]
    const onA = aIds.includes(playerId)
    const onB = bIds.includes(playerId)
    if (!onA && !onB) continue

    const opponents = onA ? bIds : aIds
    const opponentsInSet = opponents.filter((id) => others.has(id))
    if (opponentsInSet.length === 0) continue

    const myTeamWon = onA ? m.gamesA > m.gamesB : m.gamesB > m.gamesA
    const tied = m.gamesA === m.gamesB
    if (myTeamWon) score += opponentsInSet.length
    else if (!tied) score -= opponentsInSet.length
  }
  return score
}

function sortByGames(a: PlayerStanding, b: PlayerStanding): number {
  if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
  return a.player.name.localeCompare(b.player.name)
}

/**
 * Football-style standings:
 *   1) matches won (PG)
 *   2) games difference (DIF)
 *   3) head-to-head among players still tied
 *   4) name (alphabetical, stable)
 */
function sortByPoints(
  standings: PlayerStanding[],
  matches: Match[],
): PlayerStanding[] {
  const initial = [...standings].sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon
    if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff
    return a.player.name.localeCompare(b.player.name)
  })

  // Group players who tie on BOTH matchesWon AND gamesDiff — these are the
  // only groups where head-to-head can still change the order.
  const groups: PlayerStanding[][] = []
  for (const s of initial) {
    const last = groups[groups.length - 1]
    if (
      last &&
      last[0].matchesWon === s.matchesWon &&
      last[0].gamesDiff === s.gamesDiff
    ) {
      last.push(s)
    } else {
      groups.push([s])
    }
  }

  for (const group of groups) {
    if (group.length <= 1) continue
    const groupIds = new Set(group.map((s) => s.player.id))
    const h2h = new Map<string, number>()
    for (const s of group) {
      h2h.set(s.player.id, headToHeadScore(matches, s.player.id, groupIds))
    }
    group.sort((a, b) => {
      const ha = h2h.get(a.player.id) ?? 0
      const hb = h2h.get(b.player.id) ?? 0
      if (hb !== ha) return hb - ha
      return a.player.name.localeCompare(b.player.name)
    })
  }

  return groups.flat()
}

export function sortStandings(
  standings: PlayerStanding[],
  by: StandingsSort,
  matches: Match[] = [],
): PlayerStanding[] {
  if (by === "points") return sortByPoints(standings, matches)
  return [...standings].sort(sortByGames)
}
