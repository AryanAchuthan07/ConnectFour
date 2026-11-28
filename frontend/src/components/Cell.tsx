import type { Cell as Piece, Player } from '../api'

interface Props {
  row: number
  col: number
  piece: Piece
  winning: boolean
  /** The colour to preview here, if this is where the piece would land. */
  ghost?: Player
}

export function Cell({ row, col, piece, winning, ghost }: Props) {
  return (
    <span
      className="cell"
      data-cell={`${row},${col}`}
      data-piece={piece}
      data-winning={winning}
      data-ghost={ghost}
    />
  )
}
