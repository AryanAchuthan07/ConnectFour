import { useEffect, useState } from 'react'
import type { Position } from '../api'

/** How long a piece takes to fall. Matches the `drop` animation in styles.css. */
const DROP_MS = 300

/** Whether the newest piece is still on its way down. */
export function useIsFalling(landing: Position | null): boolean {
  const [landed, setLanded] = useState<Position | null>(null)

  useEffect(() => {
    if (!landing) return
    const timer = setTimeout(() => setLanded(landing), DROP_MS)
    return () => clearTimeout(timer)
  }, [landing])

  return landing !== null && landing !== landed
}
