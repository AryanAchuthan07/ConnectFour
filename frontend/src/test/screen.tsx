import { act, render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'
import type { Game } from '../api'
import { json, type fakeServer } from './fakeServer'
import { GAME_ID } from './games'

export function openPath(path: string) {
  window.history.replaceState(null, '', path)
  return render(<App />)
}

/** Opens a game and waits until its board is showing. */
export async function openGame(server: ReturnType<typeof fakeServer>, loaded: Game) {
  server.will(json(200, loaded))
  const view = openPath(`/game/${loaded.id ?? GAME_ID}`)
  await screen.findByRole('group', { name: 'Game board' })
  // The board focuses a column just after it appears. On a slow computer that can come late
  // enough for a test to run first, so wait for it.
  await waitFor(() => {
    if (!columns().includes(document.activeElement as HTMLButtonElement)) {
      throw new Error('The board has not focused a column yet')
    }
  })
  return view
}

export async function goTo(path: string) {
  await act(async () => {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

/** What's drawn in one cell: 'R', 'Y' or '.'. Row 0 is the top row. */
export const pieceAt = (row: number, col: number) =>
  document.querySelector<HTMLElement>(`[data-cell="${row},${col}"]`)?.dataset.piece

export const columns = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Game board"] button'))

export const statusText = () => screen.getByRole('status').textContent
