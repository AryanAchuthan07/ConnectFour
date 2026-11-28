import type { Cell as Piece, Game, Player } from '../api'
import { Cell } from './Cell'
import { useColumnInput } from './useColumnInput'
import { useIsFalling } from './useIsFalling'
import { useLandingPiece } from './useLandingPiece'
import { NAMES } from './words'

/** What a screen reader says for a column: the cells themselves are only drawings. */
function describeColumn(col: number, pieces: Piece[]) {
  const fromBottom = pieces.filter((piece) => piece !== '.').reverse()
  const left = pieces.length - fromBottom.length
  const room = left === 0 ? 'full' : `${left} ${left === 1 ? 'space' : 'spaces'} left`
  const contents = fromBottom.map((piece) => NAMES[piece as 'R' | 'Y']).join(', ')
  return `Column ${col + 1}, ${room}${contents && `. From the bottom: ${contents}`}`
}

interface Props {
  board: Game['board']
  /** Exactly what the server sent. The frontend never works out a winner. */
  winningCells: Game['winningCells']
  /** No moves right now: a request is on its way, or the board can't be trusted. */
  locked: boolean
  /** Whose colour the preview uses. */
  nextPlayer: Player
  onPlay: (column: number) => void
}

export function Board({ board, winningCells, locked, nextPlayer, onPlay }: Props) {
  const { usingKeyboard, previewColumn, groupProps, columnProps } = useColumnInput()
  const landing = useLandingPiece(board)
  const falling = useIsFalling(landing)
  const isWinning = (row: number, col: number) =>
    winningCells?.some(([r, c]) => r === row && c === col) ?? false

  return (
    <div
      className="board"
      role="group"
      aria-label="Game board"
      data-won={winningCells !== null}
      data-landing={landing !== null}
      data-falling={falling}
      data-keyboard={usingKeyboard}
      {...groupProps}
    >
      {board[0].map((_, col) => {
        const pieces = board.map((row) => row[col])
        const unavailable = locked || pieces[0] !== '.'
        // Where a piece would fall: the lowest empty row. Only for the preview.
        const landingRow = !unavailable && previewColumn === col ? pieces.lastIndexOf('.') : -1
        return (
          // aria-disabled, not disabled: a disabled button would drop keyboard focus.
          <button
            key={col}
            type="button"
            className="column"
            aria-label={describeColumn(col, pieces)}
            aria-disabled={unavailable}
            onClick={() => !unavailable && onPlay(col)}
            {...columnProps(col)}
          >
            {pieces.map((piece, row) => (
              <Cell
                key={row}
                row={row}
                col={col}
                piece={piece}
                winning={isWinning(row, col)}
                ghost={row === landingRow ? nextPlayer : undefined}
                dropping={landing?.[0] === row && landing[1] === col}
              />
            ))}
          </button>
        )
      })}
    </div>
  )
}
