import type { CSSProperties } from 'react'
import type { Cell as Piece, Player } from '../api'

interface Props {
  row: number
  col: number
  piece: Piece
  winning: boolean
  /** The colour to preview here, if this is where the piece would land. */
  ghost?: Player
  /** This piece has just arrived and falls into place. */
  dropping: boolean
}

/** The cell is the hole, which stays put. The disc inside it is the piece, which can fall. */
export function Cell({ row, col, piece, winning, ghost, dropping }: Props) {
  return (
    <span
      className="cell"
      data-cell={`${row},${col}`}
      data-piece={piece}
      data-winning={winning}
      data-ghost={ghost}
      data-dropping={dropping}
      // How far the piece has to fall, for the animation.
      style={{ '--row': row } as CSSProperties}
    >
      {(piece !== '.' || ghost) && <span className="disc" />}
    </span>
  )
}
