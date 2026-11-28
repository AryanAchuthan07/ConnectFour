import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { App } from './App'
import { apiError, fakeServer, held, htmlPage, json, networkFailure } from './test/fakeServer'
import { GAME_ID, OTHER_ID, game } from './test/games'
import { columns, goTo, openGame, openPath, pieceAt, statusText } from './test/screen'

const CANT_REACH = "Can't reach the server. Please try again."

describe('showing a game', () => {
  test('says it is loading until the game arrives', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(slow.answer)
    openPath(`/game/${GAME_ID}`)

    expect(screen.getByText('Loading game…')).toBeTruthy()
    await act(async () => slow.release(json(200, game())))

    expect(screen.queryByText('Loading game…')).toBeNull()
    expect(screen.getByRole('group', { name: 'Game board' })).toBeTruthy()
  })

  test('draws every piece in its row and column, with row 0 at the top', async () => {
    const rows = ['R......', '.......', '..Y....', '.......', '.......', 'Y.....R']

    await openGame(fakeServer(), game({ rows }))

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        expect(pieceAt(row, col), `cell ${row},${col}`).toBe(rows[row][col])
      }
    }
  })

  test('has seven columns, each described in words', async () => {
    const rows = ['..R....', '..Y....', '..R....', '..Y....', '.RR....', '.YY...R']

    await openGame(fakeServer(), game({ rows }))

    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual([
      'Column 1, 6 spaces left',
      'Column 2, 4 spaces left. From the bottom: Yellow, Red',
      'Column 3, full. From the bottom: Yellow, Red, Yellow, Red, Yellow, Red',
      'Column 4, 6 spaces left',
      'Column 5, 6 spaces left',
      'Column 6, 6 spaces left',
      'Column 7, 5 spaces left. From the bottom: Red',
    ])
  })

  test.each([
    ['R', "Red's turn"],
    ['Y', "Yellow's turn"],
  ] as const)('says in words whose turn it is (%s)', async (currentPlayer, words) => {
    await openGame(fakeServer(), game({ currentPlayer }))

    expect(statusText()).toBe(words)
  })

  test('copes with effects running twice, as they do in development', async () => {
    const server = fakeServer()
    server.will(json(200, game()), json(200, game()))
    window.history.replaceState(null, '', `/game/${GAME_ID}`)

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(await screen.findByRole('group', { name: 'Game board' })).toBeTruthy()
  })

  test('a late answer for one game does not replace another', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(slow.answer, json(200, game({ id: OTHER_ID, currentPlayer: 'Y' })))
    openPath(`/game/${GAME_ID}`)

    await goTo(`/game/${OTHER_ID}`)
    await screen.findByText("Yellow's turn")
    await act(async () => slow.release(json(200, game({ currentPlayer: 'R' }))))

    expect(statusText()).toBe("Yellow's turn")
  })
})

describe('a game that cannot be loaded', () => {
  test.each([
    [404, 'GAME_NOT_FOUND', "We couldn't find that game."],
    [400, 'INVALID_REQUEST', "That request wasn't valid."],
  ])('%s: says the game was not found and offers a new one', async (status, code, message) => {
    const server = fakeServer()
    server.will(apiError(status, code, message), json(201, game({ id: OTHER_ID })), json(200, game({ id: OTHER_ID })))
    openPath('/game/abc')

    expect(await screen.findByRole('heading', { name: "We couldn't find that game" })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'New game' }))

    await screen.findByRole('group', { name: 'Game board' })
    expect(window.location.pathname).toBe(`/game/${OTHER_ID}`)
  })

  test.each([
    ['no connection', networkFailure, CANT_REACH],
    ['an nginx error page', htmlPage(502), CANT_REACH],
    ['an unreadable 404', htmlPage(404), CANT_REACH],
    ['a server error', apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
      'Something went wrong. Please try again.'],
  ])('%s: shows the message, and Try again loads the game', async (_name, failure, message) => {
    const server = fakeServer()
    server.will(failure, json(200, game()))
    openPath(`/game/${GAME_ID}`)

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('group', { name: 'Game board' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('Try again can fail again, and double clicking it sends one request', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(networkFailure, slow.answer)
    openPath(`/game/${GAME_ID}`)
    const user = userEvent.setup()

    await user.dblClick(await screen.findByRole('button', { name: 'Try again' }))
    expect(server.requests).toHaveLength(2)
    await act(async () => slow.release(networkFailure))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(CANT_REACH))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
