import { Board } from '../components/Board'
import { StatusBar } from '../components/StatusBar'
import { useGame } from '../hooks/useGame'
import { HomeScreen } from './HomeScreen'

export function GameScreen({ id }: { id: string }) {
  const { view, play, playAgain, retryLoad, retrySync } = useGame(id)

  if (view.phase === 'notFound') return <HomeScreen title="We couldn't find that game" />

  return (
    <main className="screen">
      <h1 className="game-title">Connect 4</h1>
      {view.phase === 'loading' && <p>Loading game…</p>}
      {view.phase === 'loadFailed' && (
        <>
          <p role="alert" className="error">
            {view.message}
          </p>
          <button type="button" className="button" onClick={retryLoad}>
            Try again
          </button>
        </>
      )}
      {view.phase === 'ready' && (
        <>
          <StatusBar game={view.game} busy={view.busy} onPlayAgain={playAgain} />
          <Board
            board={view.game.board}
            winningCells={view.game.winningCells}
            locked={view.busy || view.outOfSync || view.game.status !== 'in_progress'}
            nextPlayer={view.game.currentPlayer}
            onPlay={play}
          />
          {view.error && (
            <p role="alert" className="error">
              {view.error}
            </p>
          )}
          {view.outOfSync && (
            <button type="button" className="button" aria-disabled={view.busy} onClick={retrySync}>
              Try again
            </button>
          )}
        </>
      )}
    </main>
  )
}
