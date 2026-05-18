import type { Match, Player, PlayerStanding } from "./types"

const WIN_POINTS = 3
const TIE_POINTS = 1

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

  return [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gamesDiff !== a.gamesDiff) return b.gamesDiff - a.gamesDiff
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
    return a.player.name.localeCompare(b.player.name)
  })
}
