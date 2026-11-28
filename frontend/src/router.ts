import { useSyncExternalStore } from 'react'

// Two screens don't need a routing library.

export type Route = { name: 'home' } | { name: 'game'; id: string } | { name: 'unknown' }

export function parseRoute(path: string): Route {
  if (path === '/') return { name: 'home' }
  const match = /^\/game\/([^/]+)\/?$/.exec(path)
  // The ID is passed on as written. The server decides whether it's valid.
  return match ? { name: 'game', id: match[1] } : { name: 'unknown' }
}

export const gamePath = (id: string) => `/game/${id}`

export function navigate(path: string, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  // pushState and replaceState don't fire an event, so announce the change.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}
