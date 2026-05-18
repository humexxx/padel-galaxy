export type PairingAlgorithm = "balanced" | "random" | "snake"

export type PozoStatus = "draft" | "warmup" | "playing" | "finished"

export type Player = {
  id: string
  name: string
}

export type Pair = {
  playerA: string
  playerB: string
}

export type Match = {
  id: string
  round: number
  court: number
  teamA: Pair
  teamB: Pair
  gamesA: number | null
  gamesB: number | null
}

export type PozoConfig = {
  courts: number
  matchesPerPlayer: number
  totalDurationMin: number
  warmupMin: number
  algorithm: PairingAlgorithm
  allowRepeatPairs: boolean
}

export type Pozo = {
  id: string
  name: string
  createdAt: number
  status: PozoStatus
  config: PozoConfig
  players: Player[]
  matches: Match[]
  currentRound: number
  totalRounds: number
  startedAt: number | null
  warmupEndsAt: number | null
  endsAt: number | null
  finishedAt: number | null
}

export type PlayerStanding = {
  player: Player
  matchesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDiff: number
  matchesWon: number
  points: number
}
