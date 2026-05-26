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
  /**
   * When true (default) the warmup eats into `totalDurationMin`, so play time
   * is `totalDurationMin - warmupMin`. When false, warmup is added on top:
   * total wall-clock time is `warmupMin + totalDurationMin`.
   * Optional for backwards-compat with pozos created before this flag existed.
   */
  warmupIncludedInTotal?: boolean
  algorithm: PairingAlgorithm
  allowRepeatPairs: boolean
}

export type Pozo = {
  id: string
  ownerId: string
  /**
   * Group this pozo belongs to. Required for new pozos created via the form,
   * but kept optional in the type for backwards-compat: pozos created before
   * the groups feature have no groupId until the migration script runs.
   */
  groupId?: string
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
  matchesWon: number
  /** Matches that ended in a tie (gamesA === gamesB). */
  matchesTied: number
  /** Matches the player's team lost outright (no ties counted). */
  matchesLost: number
  gamesWon: number
  gamesLost: number
  gamesDiff: number
  points: number
}
