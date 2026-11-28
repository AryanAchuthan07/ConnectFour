import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { apiError, fakeServer, held, htmlPage, json, networkFailure } from './test/fakeServer'
import { GAME_ID, OTHER_ID, game } from './test/games'
import { columns, goTo, openGame, pieceAt, statusText } from './test/screen'

const CANT_REACH = "Can't reach the server. Please try again."
const STALE = 'The game has changed. Check the board and try again.'

const ROW = '.......'
const empty = [ROW, ROW, ROW, ROW, ROW]
const afterRedInColumn4 = game({ rows: [...empty, '...R...'], currentPlayer: 'Y', moveCount: 1 })
const changedElsewhere = game({ rows: [...empty, 'RY.....'], moveCount: 2 })

const unavailable = () => columns().map((column) => column.getAttribute('aria-disabled') === 'true')
const allLocked = Array(7).fill(true)
const allOpen = Array(7).fill(false)
const alertText = () => screen.queryByRole('alert')?.textContent ?? null
const tryAgain = () => screen.queryByRole('button', { name: 'Try again' })
const clickColumn = (col: number) => userEvent.setup().click(columns()[col])

describe('making a move', () => {
  test("sends the column and the server's move count", async () => {
    const server = fakeServer()
    await openGame(server, game({ moveCount: 7, currentPlayer: 'Y' }))
    server.will(json(200, game({ moveCount: 8 })))

    await clickColumn(3)

    expect(server.requests[1]).toEqual({
      method: 'POST',
      url: `/api/games/${GAME_ID}/moves`,
      body: { column: 3, moveCount: 7 },
    })
  })

  test("shows the piece only once the server accepts it, then it's the other player's turn", async () => {
    const server = fakeServer()
    await openGame(server, game())
    const slow = held()
    server.will(slow.answer)

    await clickColumn(3)
    expect(pieceAt(5, 3)).toBe('.')
    expect(statusText()).toBe("Red's turn")
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(pieceAt(5, 3)).toBe('R')
    expect(statusText()).toBe("Yellow's turn")
  })

  test("draws what the server returns, even if it isn't where the player clicked", async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(json(200, game({ rows: [...empty, '......R'], currentPlayer: 'Y', moveCount: 1 })))

    await clickColumn(0)

    expect(pieceAt(5, 6)).toBe('R')
    expect(pieceAt(5, 0)).toBe('.')
  })

  test('locks every column until the server answers, without removing them from keyboard reach', async () => {
    const server = fakeServer()
    await openGame(server, game())
    const slow = held()
    server.will(slow.answer)

    await clickColumn(3)
    expect(unavailable()).toEqual(allLocked)
    expect(columns().some((column) => column.disabled)).toBe(false)
    await clickColumn(4)
    expect(server.requests).toHaveLength(2)
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(unavailable()).toEqual(allOpen)
  })

  test('two clicks that arrive before the screen redraws send one move', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(held().answer)

    act(() => {
      fireEvent.click(columns()[3])
      fireEvent.click(columns()[3])
    })

    expect(server.requests).toHaveLength(2)
  })

  test('the next move sends the new move count', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(json(200, afterRedInColumn4), json(200, game({ moveCount: 2 })))

    await clickColumn(3)
    await clickColumn(2)

    expect(server.requests[2].body).toEqual({ column: 2, moveCount: 1 })
  })

  test('a full column is unavailable and sends nothing', async () => {
    const server = fakeServer()
    await openGame(server, game({ rows: ['R......', 'Y......', 'R......', 'Y......', 'R......', 'Y......'], moveCount: 6 }))

    expect(unavailable()).toEqual([true, false, false, false, false, false, false])
    await clickColumn(0)

    expect(server.requests).toHaveLength(1)
  })

  test("an answer that arrives after leaving doesn't change the next game", async () => {
    const server = fakeServer()
    await openGame(server, game())
    const slow = held()
    server.will(slow.answer, json(200, game({ id: OTHER_ID })))
    await clickColumn(3)

    await goTo(`/game/${OTHER_ID}`)
    await screen.findByRole('group', { name: 'Game board' })
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(pieceAt(5, 3)).toBe('.')
    expect(statusText()).toBe("Red's turn")
  })
})

describe('when a move fails', () => {
  test.each([
    ['an out-of-date game (409)', apiError(409, 'STALE_MOVE', STALE), STALE],
    ['a column that filled up (409)', apiError(409, 'COLUMN_FULL', 'That column is full.'), 'That column is full.'],
    ['a server error', apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'),
      'Something went wrong. Please try again.'],
    ['a network failure', networkFailure, CANT_REACH],
    ['an nginx timeout page', htmlPage(504), CANT_REACH],
    ['an unreadable success', htmlPage(200), CANT_REACH],
  ])('%s: reloads the game and keeps showing the message', async (_name, failure, message) => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(failure, json(200, changedElsewhere))

    await clickColumn(3)

    await waitFor(() => expect(pieceAt(5, 1)).toBe('Y'))
    expect(server.requests[2]).toMatchObject({ method: 'GET', url: `/api/games/${GAME_ID}` })
    expect(alertText()).toBe(message)
    expect(unavailable()).toEqual(allOpen)
    expect(tryAgain()).toBeNull()
  })

  test('the message goes away once a move works', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(apiError(409, 'STALE_MOVE', STALE), json(200, changedElsewhere), json(200, game({ moveCount: 3 })))
    await clickColumn(3)
    await waitFor(() => expect(alertText()).toBe(STALE))

    await clickColumn(3)

    await waitFor(() => expect(alertText()).toBeNull())
    expect(server.requests[3].body).toEqual({ column: 3, moveCount: 2 })
  })

  test('columns stay locked while the game reloads', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(apiError(409, 'STALE_MOVE', STALE), held().answer)

    await clickColumn(3)

    await waitFor(() => expect(alertText()).toBe(STALE))
    expect(unavailable()).toEqual(allLocked)
  })

  test('a rejection that leaves the game as it was is only shown, without reloading', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(apiError(400, 'INVALID_COLUMN', "That column doesn't exist."))

    await clickColumn(3)

    await waitFor(() => expect(alertText()).toBe("That column doesn't exist."))
    expect(server.requests).toHaveLength(2)
    expect(unavailable()).toEqual(allOpen)
  })

  test.each([
    ['the move', [apiError(404, 'GAME_NOT_FOUND', "We couldn't find that game.")]],
    ['the reload', [networkFailure, apiError(404, 'GAME_NOT_FOUND', "We couldn't find that game.")]],
  ])('if %s says the game is gone, shows the not-found screen', async (_name, answers) => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(...answers)

    await clickColumn(3)

    expect(await screen.findByRole('heading', { name: "We couldn't find that game" })).toBeTruthy()
  })

  test('if reloading fails too, moves stay locked until Try again works', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(networkFailure, htmlPage(502))
    await clickColumn(3)
    await waitFor(() => expect(tryAgain()).not.toBeNull())

    // The board stays visible, but nothing can be played on it.
    expect(alertText()).toBe(CANT_REACH)
    expect(unavailable()).toEqual(allLocked)
    await clickColumn(2)
    expect(server.requests).toHaveLength(3)

    server.will(networkFailure)
    await userEvent.setup().click(tryAgain()!)
    expect(tryAgain()).not.toBeNull()
    expect(unavailable()).toEqual(allLocked)

    const slow = held()
    server.will(slow.answer)
    await userEvent.setup().dblClick(tryAgain()!)
    expect(server.requests).toHaveLength(5)
    await act(async () => slow.release(json(200, changedElsewhere)))

    expect(pieceAt(5, 1)).toBe('Y')
    expect(alertText()).toBeNull()
    expect(tryAgain()).toBeNull()
    expect(unavailable()).toEqual(allOpen)
  })
})
