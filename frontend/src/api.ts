export type Player = 'R' | 'Y'
export type Cell = '.' | Player

/** The game object every game endpoint returns. `board[row][col]`, with row 0 at the top. */
export interface Game {
  id: string
  board: Cell[][]
  currentPlayer: Player
  status: 'in_progress' | 'red_won' | 'yellow_won' | 'draw'
  winningCells: [number, number][] | null
  moveCount: number
}

export const CANT_REACH = "Can't reach the server. Please try again."

// Without a limit, a request that never answers would leave the controls locked.
const TIMEOUT_MS = 20_000

const STATUSES: Game['status'][] = ['in_progress', 'red_won', 'yellow_won', 'draw']

/** Any failed request. `message` is ready to show to the player. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or null if no response arrived. */
    readonly status: number | null,
    /** The server's error code, or null if there was no readable answer. */
    readonly code: string | null,
  ) {
    super(message)
  }

  /**
   * Whether the screen may now differ from the saved game: it was out of date (409), or a move may
   * have been saved even though no good answer came back.
   */
  get shouldReload(): boolean {
    return this.code === null || this.status === 409 || (this.status !== null && this.status >= 500)
  }
}

export function createGame(): Promise<Game> {
  return request('/api/games', { method: 'POST' })
}

export function getGame(id: string): Promise<Game> {
  return request(`/api/games/${encodeURIComponent(id)}`)
}

/** `moveCount` is the number of moves already made, as last received from the server. */
export function makeMove(id: string, column: number, moveCount: number): Promise<Game> {
  return request(`/api/games/${encodeURIComponent(id)}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column, moveCount }),
  })
}

async function request(url: string, init: RequestInit = {}): Promise<Game> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let status: number | null = null
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    status = response.status
    const body: unknown = await response.json()
    if (response.ok && isGame(body)) return body
    const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error
    if (!response.ok && typeof error?.code === 'string' && typeof error.message === 'string') {
      throw new ApiError(error.message, status, error.code)
    }
    throw new ApiError(CANT_REACH, status, null)
  } catch (reason) {
    if (reason instanceof ApiError) throw reason
    // A network failure, a timeout, or a page that isn't JSON, such as nginx's own 502.
    throw new ApiError(CANT_REACH, status, null)
  } finally {
    clearTimeout(timer)
  }
}

// A 200 alone isn't enough: a missing proxy rule would serve the app's own page with a 200.
function isGame(body: unknown): body is Game {
  const game = body as Partial<Game> | null
  return (
    typeof game?.id === 'string' &&
    typeof game.moveCount === 'number' &&
    STATUSES.includes(game.status as Game['status']) &&
    Array.isArray(game.board) &&
    game.board.length === 6 &&
    game.board.every((row) => Array.isArray(row) && row.length === 7)
  )
}
