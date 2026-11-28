import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, test } from 'vitest'
import { App } from './App'
import { apiError, fakeServer, held, json, networkFailure } from './test/fakeServer'
import { GAME_ID, game } from './test/games'

// StrictMode runs effects twice, as in development, to catch code that can't cope with that.
const open = (path: string) => {
  window.history.replaceState(null, '', path)
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
const newGameButton = () => screen.getByRole('button', { name: 'New game' })

async function goBack() {
  await act(async () => {
    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
    window.history.back()
    await popped
  })
}

describe('home screen', () => {
  test('shows the title and a New game button, and asks the server for nothing', () => {
    const server = fakeServer()

    open('/')

    expect(screen.getByRole('heading', { name: 'Connect 4' })).toBeTruthy()
    expect(newGameButton()).toBeTruthy()
    expect(server.requests).toEqual([])
  })

  test('New game creates a game and goes to its address', async () => {
    const server = fakeServer()
    server.will(json(201, game()), json(200, game()), json(200, game()))
    open('/')

    await userEvent.setup().click(newGameButton())

    await waitFor(() => expect(window.location.pathname).toBe(`/game/${GAME_ID}`))
    expect(server.requests[0]).toMatchObject({ method: 'POST', url: '/api/games' })
    expect(screen.queryByRole('button', { name: 'New game' })).toBeNull()
  })

  test('clicking twice creates only one game', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(slow.answer)
    open('/')
    const user = userEvent.setup()

    await user.dblClick(newGameButton())

    expect(server.requests).toHaveLength(1)
    expect(newGameButton().getAttribute('aria-disabled')).toBe('true')
  })

  test('shows why a game could not be created, and can try again', async () => {
    const server = fakeServer()
    server.will(apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'), networkFailure)
    open('/')
    const user = userEvent.setup()

    await user.click(newGameButton())
    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong. Please try again.')

    await user.click(newGameButton())
    await screen.findByText("Can't reach the server. Please try again.")
    expect(window.location.pathname).toBe('/')
    expect(server.requests).toHaveLength(2)
  })
})

describe('navigation', () => {
  test('a game address opens that game directly', async () => {
    const server = fakeServer()
    server.will(json(200, game()), json(200, game()))

    open(`/game/${GAME_ID}`)

    await waitFor(() => expect(server.requests[0]?.url).toBe(`/api/games/${GAME_ID}`))
    expect(screen.queryByRole('button', { name: 'New game' })).toBeNull()
  })

  test('Back returns from a game to the home screen', async () => {
    fakeServer().will(json(201, game()), json(200, game()), json(200, game()))
    open('/')
    await userEvent.setup().click(newGameButton())
    await waitFor(() => expect(window.location.pathname).toBe(`/game/${GAME_ID}`))

    await goBack()

    expect(window.location.pathname).toBe('/')
    expect(newGameButton()).toBeTruthy()
  })

  test.each(['/nothing', '/game', '/game/', '/game/a/b'])('%s goes to the home screen', (path) => {
    fakeServer()

    open(path)

    expect(window.location.pathname).toBe('/')
    expect(newGameButton()).toBeTruthy()
  })

  test('an address with broken encoding does not crash', async () => {
    fakeServer().will(
      apiError(400, 'INVALID_REQUEST', "That request wasn't valid."),
      apiError(400, 'INVALID_REQUEST', "That request wasn't valid."),
    )

    open('/game/%E0%A4%A')

    expect(await screen.findByRole('heading')).toBeTruthy()
  })

  test('a game that is created after the player has left does not move them', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(json(200, game()), json(200, game()), slow.answer)
    // Start on a game, go home, press New game, then go back before the answer arrives.
    open(`/game/${GAME_ID}`)
    await waitFor(() => expect(server.requests.length).toBeGreaterThan(0))
    await act(async () => {
      window.history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await userEvent.setup().click(newGameButton())
    server.will(json(200, game()), json(200, game()))
    await goBack()

    await act(async () => slow.release(json(201, game({ id: 'late' }))))

    expect(window.location.pathname).toBe(`/game/${GAME_ID}`)
  })
})
