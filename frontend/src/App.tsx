import { useEffect, useState } from 'react'
import { checkHealth } from './api'

type ApiStatus = 'checking' | 'ok' | 'unavailable'

const LABELS: Record<ApiStatus, string> = {
  checking: 'Checking API…',
  ok: 'API OK',
  unavailable: 'API unavailable',
}

// Temporary status page for the walking skeleton. The home screen replaces it in Phase 4.
export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    checkHealth(controller.signal).then((healthy) => {
      if (!controller.signal.aborted) setStatus(healthy ? 'ok' : 'unavailable')
    })
    return () => controller.abort()
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '3rem 1rem' }}>
      <h1>Connect 4</h1>
      <p role="status">{LABELS[status]}</p>
    </main>
  )
}
