import type { Game } from '../api'
import { NAMES } from './words'

const RESULTS = { red_won: 'Red wins', yellow_won: 'Yellow wins', draw: 'Draw' }
const WINNERS = { red_won: 'R', yellow_won: 'Y' } as const

interface Props {
  game: Game
  busy: boolean
  onPlayAgain: () => void
}

/** Whose turn it is, or how the game ended. Always in words, not just colour. */
export function StatusBar({ game, busy, onPlayAgain }: Props) {
  const over = game.status !== 'in_progress'
  const swatch =
    game.status === 'in_progress'
      ? game.currentPlayer
      : game.status === 'draw'
        ? null
        : WINNERS[game.status]
  return (
    <div className="status-bar" data-over={over}>
      <p role="status" className="status">
        {swatch && <span className="swatch" data-piece={swatch} aria-hidden="true" />}
        {game.status === 'in_progress' ? `${NAMES[game.currentPlayer]}'s turn` : RESULTS[game.status]}
      </p>
      {over && (
        <button type="button" className="button" aria-disabled={busy} onClick={onPlayAgain}>
          Play again
        </button>
      )}
    </div>
  )
}
