import { useRef, useState } from 'react'
import { ApiError, createGame } from '../api'
import { useIsMounted } from '../hooks/useIsMounted'
import { gamePath, navigate } from '../router'

export function HomeScreen({ title = 'Connect 4' }: { title?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A ref locks at once. State only changes at the next render, too late to stop a double click.
  const locked = useRef(false)
  const isMounted = useIsMounted()

  async function startGame() {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      const game = await createGame()
      if (isMounted()) navigate(gamePath(game.id))
    } catch (reason) {
      if (isMounted()) setError((reason as ApiError).message)
    } finally {
      locked.current = false
      if (isMounted()) setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>{title}</h1>
      <button type="button" className="button" aria-disabled={busy} onClick={startGame}>
        New game
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  )
}
