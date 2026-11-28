import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { Game } from './api'
import { apiError, fakeServer, held, json, networkFailure } from './test/fakeServer'
import { OTHER_ID, game } from './test/games'
import { columns, goTo, openGame, pieceAt, statusText } from './test/screen'

const ROW = '.......'
const bottomRowWin = [ROW, ROW, ROW, ROW, 'YYY....', 'RRRR...']

const redWon = game({
  rows: bottomRowWin,
  status: 'red_won',
  winningCells: [[5, 0], [5, 1], [5, 2], [5, 3]],
  moveCount: 7,
})
const yellowWon = game({
  rows: [ROW, ROW, ROW, ROW, 'RRR...R', 'YYYY...'],
  status: 'yellow_won',
  currentPlayer: 'Y',
  winningCells: [[5, 0], [5, 1], [5, 2], [5, 3]],
  moveCount: 8,
})
const drawn = game({
  rows: ['YYRRYYR', 'RRYYRRY', 'YYRRYYR', 'RRYYRRY', 'YYRRYYR', 'RRYYRRY'],
  status: 'draw',
  currentPlayer: 'Y',
  moveCount: 42,
})

const highlighted = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-winning="true"]')).map((cell) => cell.dataset.cell)
const playAgain = () => screen.queryByRole('button', { name: 'Play again' })
const board = () => screen.getByRole('group', { name: 'Game board' })

describe('the end of a game', () => {
  test.each([
    ['Red wins', redWon],
    ['Yellow wins', yellowWon],
    ['Draw', drawn],
  ])('the banner says "%s" in words and offers a rematch', async (words, finished: Game) => {
    await openGame(fakeServer(), finished)

    expect(statusText()).toBe(words)
    expect(playAgain()).not.toBeNull()
  })

  test('there is no Play again button during a game', async () => {
    await openGame(fakeServer(), game())

    expect(playAgain()).toBeNull()
  })

  test('the winning move brings up the result straight away', async () => {
    const server = fakeServer()
    await openGame(server, game({ rows: [ROW, ROW, ROW, ROW, 'YYY....', 'RRR....'], moveCount: 6 }))
    server.will(json(200, redWon))

    await userEvent.setup().click(columns()[3])

    await waitFor(() => expect(statusText()).toBe('Red wins'))
    expect(highlighted()).toEqual(['5,0', '5,1', '5,2', '5,3'])
  })

  test('highlights exactly the cells the server lists, however many', async () => {
    const six = game({
      rows: [ROW, ROW, ROW, ROW, 'YYY.YY.', 'RRRRRR.'],
      status: 'red_won',
      winningCells: [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5]],
      moveCount: 11,
    })

    await openGame(fakeServer(), six)

    expect(highlighted().sort()).toEqual(['5,0', '5,1', '5,2', '5,3', '5,4', '5,5'])
    expect(board().dataset.won).toBe('true')
  })

  test('never works out a winner itself', async () => {
    // Four in a row, but the server says the game is still going.
    await openGame(fakeServer(), game({ rows: bottomRowWin, currentPlayer: 'Y', moveCount: 7 }))

    expect(statusText()).toBe("Yellow's turn")
    expect(highlighted()).toEqual([])
    expect(board().dataset.won).toBe('false')
    expect(playAgain()).toBeNull()
  })

  test('a draw highlights nothing and fades nothing', async () => {
    await openGame(fakeServer(), drawn)

    expect(highlighted()).toEqual([])
    expect(board().dataset.won).toBe('false')
  })

  test('no more moves can be made', async () => {
    const server = fakeServer()
    await openGame(server, redWon)

    expect(columns().map((column) => column.getAttribute('aria-disabled'))).toEqual(Array(7).fill('true'))
    await userEvent.setup().click(columns()[6])

    expect(server.requests).toHaveLength(1)
  })

  test('a tab that learns the game is over shows the result alongside the reason', async () => {
    const server = fakeServer()
    await openGame(server, game())
    server.will(apiError(409, 'STALE_MOVE', 'The game has changed. Check the board and try again.'), json(200, redWon))

    await userEvent.setup().click(columns()[4])

    await waitFor(() => expect(statusText()).toBe('Red wins'))
    expect(screen.getByRole('alert').textContent).toBe('The game has changed. Check the board and try again.')
  })
})

describe('Play again', () => {
  const rematch = game({ id: OTHER_ID })

  test('creates a new game and moves to it', async () => {
    const server = fakeServer()
    await openGame(server, redWon)
    server.will(json(201, rematch), json(200, rematch))

    await userEvent.setup().click(playAgain()!)

    await waitFor(() => expect(statusText()).toBe("Red's turn"))
    expect(server.requests[1]).toMatchObject({ method: 'POST', url: '/api/games' })
    expect(window.location.pathname).toBe(`/game/${OTHER_ID}`)
    expect(pieceAt(5, 0)).toBe('.')
    expect(playAgain()).toBeNull()
  })

  test('clicking twice creates only one game', async () => {
    const server = fakeServer()
    await openGame(server, redWon)
    server.will(held().answer)

    await userEvent.setup().dblClick(playAgain()!)

    expect(server.requests).toHaveLength(2)
    expect(playAgain()!.getAttribute('aria-disabled')).toBe('true')
  })

  test('if it fails, the finished game stays with a message, and it can be pressed again', async () => {
    const server = fakeServer()
    await openGame(server, redWon)
    server.will(networkFailure)

    await userEvent.setup().click(playAgain()!)

    expect((await screen.findByRole('alert')).textContent).toBe("Can't reach the server. Please try again.")
    expect(statusText()).toBe('Red wins')
    // The finished game can't have changed, so there is nothing to reload.
    expect(server.requests).toHaveLength(2)
    expect(playAgain()!.getAttribute('aria-disabled')).toBe('false')
  })

  test('an answer that arrives after leaving does not move the player', async () => {
    const server = fakeServer()
    await openGame(server, redWon)
    const slow = held()
    server.will(slow.answer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Play again' }))
    expect(server.requests).toHaveLength(2)

    await goTo('/')
    await act(async () => slow.release(json(201, rematch)))

    expect(window.location.pathname).toBe('/')
  })
})
