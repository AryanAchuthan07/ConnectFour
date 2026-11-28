import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { apiError, fakeServer, held, json, networkFailure } from './test/fakeServer'
import { OTHER_ID, game } from './test/games'
import { columns, goTo, openGame, statusText } from './test/screen'

const ROW = '.......'
const rows = (...bottom: string[]) => [...Array(6 - bottom.length).fill(ROW), ...bottom]

const start = game({ rows: rows('...R...'), currentPlayer: 'Y', moveCount: 1 })
const oneMore = game({ rows: rows('...Y...', '...R...'), moveCount: 2 })
const twoMore = game({ rows: rows('...Y...', '...R.R.'), currentPlayer: 'Y', moveCount: 3 })
const STALE = 'The game has changed. Check the board and try again.'

/** Which cells are marked to fall into place, as "row,col". */
const dropping = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-dropping="true"]')).map((cell) => cell.dataset.cell)

async function open(loaded = start) {
  const server = fakeServer()
  await openGame(server, loaded)
  return { server, user: userEvent.setup() }
}

describe('which piece drops', () => {
  test('nothing drops when a game with pieces is opened or refreshed', async () => {
    await open(twoMore)

    expect(dropping()).toEqual([])
  })

  test('an accepted move drops exactly the new piece, and not before the server answers', async () => {
    const { server, user } = await open()
    const slow = held()
    server.will(slow.answer)

    await user.click(columns()[3])
    expect(dropping()).toEqual([])
    await act(async () => slow.release(json(200, oneMore)))

    expect(dropping()).toEqual(['4,3'])
  })

  test("sending the next move doesn't restart the last piece, and then only the new one drops", async () => {
    const { server, user } = await open()
    const slow = held()
    server.will(json(200, oneMore), slow.answer)
    await user.click(columns()[3])
    const marked = document.querySelector('[data-dropping="true"]')

    await user.click(columns()[5])
    expect(dropping()).toEqual(['4,3'])
    expect(document.querySelector('[data-dropping="true"]')).toBe(marked)
    await act(async () => slow.release(json(200, twoMore)))

    expect(dropping()).toEqual(['5,5'])
  })

  test('a reload that brings one new move drops it', async () => {
    const { server, user } = await open()
    server.will(apiError(409, 'STALE_MOVE', STALE), json(200, oneMore))

    await user.click(columns()[0])

    await waitFor(() => expect(dropping()).toEqual(['4,3']))
  })

  test('a reload that brings several new moves drops nothing', async () => {
    const { server, user } = await open()
    server.will(apiError(409, 'STALE_MOVE', STALE), json(200, twoMore))

    await user.click(columns()[0])

    await waitFor(() => expect(statusText()).toBe("Yellow's turn"))
    await screen.findByRole('alert')
    expect(dropping()).toEqual([])
  })

  test('a failed move that leaves the board alone drops nothing', async () => {
    const { server, user } = await open()
    server.will(networkFailure, json(200, start))

    await user.click(columns()[0])

    await screen.findByRole('alert')
    expect(dropping()).toEqual([])
  })

  test("moving to another game doesn't drop its pieces, even if it has one more", async () => {
    const { server } = await open()
    server.will(json(200, { ...oneMore, id: OTHER_ID }))

    await goTo(`/game/${OTHER_ID}`)
    await screen.findByText("Red's turn")

    expect(dropping()).toEqual([])
  })

  test('a winning piece drops, and the board knows a piece is landing', async () => {
    const before = game({ rows: rows('YYY....', 'RRR....'), moveCount: 6 })
    const won = game({
      rows: rows('YYY....', 'RRRR...'),
      status: 'red_won',
      winningCells: [[5, 0], [5, 1], [5, 2], [5, 3]],
      moveCount: 7,
    })
    const { server, user } = await open(before)
    server.will(json(200, won))

    await user.click(columns()[3])

    await waitFor(() => expect(statusText()).toBe('Red wins'))
    expect(dropping()).toEqual(['5,3'])
    expect(screen.getByRole('group', { name: 'Game board' }).dataset.landing).toBe('true')
  })

  test('an already finished game has nothing landing', async () => {
    await open(game({ rows: rows('YYY....', 'RRRR...'), status: 'red_won', winningCells: [[5, 0]], moveCount: 7 }))

    expect(screen.getByRole('group', { name: 'Game board' }).dataset.landing).toBe('false')
  })
})

describe('while a piece is falling', () => {
  // The styles hide the preview while the board says a piece is falling.
  const falling = () => screen.getByRole('group', { name: 'Game board' }).dataset.falling
  const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
  const clickColumn = async (col: number) => {
    await act(async () => {
      fireEvent.click(columns()[col])
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  async function openWithFakeClock(...answers: Parameters<ReturnType<typeof fakeServer>['will']>) {
    const { server } = await open()
    server.will(...answers)
    vi.useFakeTimers()
    return server
  }

  test('nothing is falling when a game opens', async () => {
    await open(twoMore)

    expect(falling()).toBe('false')
  })

  test('a new piece counts as falling for 300 ms, the length of the drop', async () => {
    await openWithFakeClock(json(200, oneMore))

    await clickColumn(3)
    expect(falling()).toBe('true')
    await wait(299)
    expect(falling()).toBe('true')
    await wait(1)

    expect(falling()).toBe('false')
  })

  test('a second piece sent during the first drop gets its own full 300 ms', async () => {
    await openWithFakeClock(json(200, oneMore), json(200, twoMore))
    await clickColumn(3)
    await wait(200)

    await clickColumn(5)
    await wait(299)
    expect(falling()).toBe('true')
    await wait(1)

    expect(falling()).toBe('false')
  })

  test('sending a move after a piece has landed does not make it fall again', async () => {
    await openWithFakeClock(json(200, oneMore), held().answer)
    await clickColumn(3)
    await wait(300)

    await clickColumn(5)

    expect(falling()).toBe('false')
  })
})
