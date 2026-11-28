import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, createGame, getGame, makeMove, type Game } from '../api'
import { gamePath, navigate } from '../router'
import { useIsMounted } from './useIsMounted'

interface Ready {
  phase: 'ready'
  game: Game
  /** A request is on its way, so no move can be made. */
  busy: boolean
  /** The latest failure, in words for the player. */
  error: string | null
  /** The board may differ from the saved game and couldn't be reloaded. Moves stay locked. */
  outOfSync: boolean
}

export type GameView =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'loadFailed'; message: string }
  | Ready

const ready = (game: Game, changes: Partial<Ready> = {}): Ready => ({
  phase: 'ready',
  game,
  busy: false,
  error: null,
  outOfSync: false,
  ...changes,
})

// A readable "no such game" answer. An unreadable 404 might come from anywhere.
const isMissing = (error: ApiError) =>
  error.code !== null && (error.status === 404 || error.status === 400)

function viewAfterFailedLoad(error: ApiError): GameView {
  return isMissing(error) ? { phase: 'notFound' } : { phase: 'loadFailed', message: error.message }
}

export function useGame(id: string) {
  const [view, setView] = useState<GameView>({ phase: 'loading' })
  // A ref locks at once. State only changes at the next render, too late to stop a double click.
  const locked = useRef(false)
  const isMounted = useIsMounted()

  useEffect(() => {
    let current = true
    getGame(id).then(
      (game) => current && setView(ready(game)),
      (reason: ApiError) => current && setView(viewAfterFailedLoad(reason)),
    )
    return () => {
      current = false
    }
  }, [id])

  /** Runs one request at a time. Screen changes are dropped once the player has left. */
  const exclusively = useCallback(
    async (task: (show: (next: GameView) => void) => Promise<void>) => {
      if (locked.current) return
      locked.current = true
      try {
        await task((next) => isMounted() && setView(next))
      } finally {
        locked.current = false
      }
    },
    [isMounted],
  )

  const retryLoad = () =>
    exclusively(async (show) => {
      try {
        show(ready(await getGame(id)))
      } catch (reason) {
        show(viewAfterFailedLoad(reason as ApiError))
      }
    })

  /** Fetches the saved game again after a failure. `message` stays on screen if it works. */
  async function resync(game: Game, message: string | null, show: (next: GameView) => void) {
    try {
      show(ready(await getGame(id), { error: message }))
    } catch (reason) {
      const failure = reason as ApiError
      show(
        isMissing(failure)
          ? { phase: 'notFound' }
          : ready(game, { error: failure.message, outOfSync: true }),
      )
    }
  }

  function play(column: number) {
    if (view.phase !== 'ready' || view.outOfSync || view.game.status !== 'in_progress') return
    const { game } = view
    void exclusively(async (show) => {
      show(ready(game, { busy: true }))
      try {
        show(ready(await makeMove(id, column, game.moveCount)))
      } catch (reason) {
        const failure = reason as ApiError
        if (failure.status === 404 && failure.code !== null) {
          show({ phase: 'notFound' })
        } else if (failure.shouldReload) {
          show(ready(game, { busy: true, error: failure.message }))
          await resync(game, failure.message, show)
        } else {
          show(ready(game, { error: failure.message }))
        }
      }
    })
  }

  /** The "Try again" button shown while out of sync. */
  function retrySync() {
    if (view.phase !== 'ready') return
    const { game, error } = view
    void exclusively(async (show) => {
      show(ready(game, { busy: true, error, outOfSync: true }))
      await resync(game, null, show)
    })
  }

  /** A rematch is simply a new game. The finished one stays saved. */
  function playAgain() {
    if (view.phase !== 'ready') return
    const { game } = view
    void exclusively(async (show) => {
      show(ready(game, { busy: true }))
      try {
        const next = await createGame()
        if (isMounted()) navigate(gamePath(next.id))
      } catch (reason) {
        show(ready(game, { error: (reason as ApiError).message }))
      }
    })
  }

  return { view, play, playAgain, retryLoad, retrySync }
}
