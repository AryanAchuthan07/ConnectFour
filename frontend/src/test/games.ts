import type { Game } from '../api'

export const GAME_ID = '3f2b8c1e-9d4a-4e7b-a1c6-5f0d2e8b9a34'
export const OTHER_ID = '7a1d4c2f-0b3e-4a59-8c6d-1e2f3a4b5c6d'

const EMPTY_ROWS = ['.......', '.......', '.......', '.......', '.......', '.......']

/** A game object as the server sends it. Rows are written as strings, top row first. */
export function game(changes: Partial<Omit<Game, 'board'>> & { rows?: string[] } = {}): Game {
  const { rows = EMPTY_ROWS, ...rest } = changes
  return {
    id: GAME_ID,
    board: rows.map((row) => row.split('') as Game['board'][number]),
    currentPlayer: 'R',
    status: 'in_progress',
    winningCells: null,
    moveCount: 0,
    ...rest,
  }
}
