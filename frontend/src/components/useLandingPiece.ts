import { useState } from 'react'
import type { Game, Position } from '../api'

/** The one piece that appeared between two boards, or null if that isn't what changed. */
function onlyNewPiece(before: Game['board'], after: Game['board']): Position | null | 'unchanged' {
  const changed: Position[] = []
  let added = true
  after.forEach((cells, row) =>
    cells.forEach((piece, col) => {
      if (piece === before[row][col]) return
      changed.push([row, col])
      added &&= before[row][col] === '.'
    }),
  )
  if (changed.length === 0) return 'unchanged'
  return changed.length === 1 && added ? changed[0] : null
}

/**
 * Which piece should fall into place: the one new piece since the board last changed. Nothing
 * falls when a screen first appears. This only compares boards and says nothing about the rules.
 */
export function useLandingPiece(board: Game['board']): Position | null {
  const [seen, setSeen] = useState<{ board: Game['board']; landing: Position | null }>({
    board,
    landing: null,
  })
  // Updating state while rendering is React's way to react to a changed prop without an effect.
  if (board !== seen.board) {
    const change = onlyNewPiece(seen.board, board)
    // A reload can return the same position. The last piece then stays as it was.
    setSeen({ board, landing: change === 'unchanged' ? seen.landing : change })
  }
  return seen.landing
}
