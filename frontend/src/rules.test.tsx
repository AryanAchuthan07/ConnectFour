import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { apiError, fakeServer, held, json, networkFailure } from './test/fakeServer'
import { GAME_ID, game } from './test/games'
import { columns, openGame, openPath, pieceAt, statusText } from './test/screen'

const rulesButton = () => screen.getByRole('button', { name: 'Rules' })
const popup = () => screen.queryByRole('dialog', { name: 'How to play' }) as HTMLDialogElement | null
const closeButton = () => screen.getByRole('button', { name: 'Close' })

describe('where the Rules button is', () => {
  test('on the home screen, with the rules closed until asked for', () => {
    fakeServer()
    openPath('/')

    expect(rulesButton()).toBeTruthy()
    expect(popup()).toBeNull()
  })

  test('on the game screen, with the rules closed until asked for', async () => {
    await openGame(fakeServer(), game())

    expect(rulesButton()).toBeTruthy()
    expect(popup()).toBeNull()
  })

  test('on the "game not found" screen', async () => {
    fakeServer().will(apiError(404, 'GAME_NOT_FOUND', "We couldn't find that game."))
    openPath(`/game/${GAME_ID}`)

    await screen.findByRole('heading', { name: "We couldn't find that game" })

    expect(rulesButton()).toBeTruthy()
  })

  test('while a game is loading, and when it fails to load', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(slow.answer)
    openPath(`/game/${GAME_ID}`)
    expect(rulesButton()).toBeTruthy()

    await act(async () => slow.release(networkFailure))

    await screen.findByRole('button', { name: 'Try again' })
    expect(rulesButton()).toBeTruthy()
  })
})

describe('opening and closing', () => {
  test('opens as a modal popup, which blocks the page behind it', async () => {
    fakeServer()
    openPath('/')
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')

    await userEvent.setup().click(rulesButton())

    expect(popup()).not.toBeNull()
    expect(showModal).toHaveBeenCalledOnce()
    showModal.mockRestore()
  })

  test('the Close button closes it, and it can be opened again', async () => {
    fakeServer()
    openPath('/')
    const user = userEvent.setup()
    await user.click(rulesButton())

    await user.click(closeButton())
    expect(popup()).toBeNull()
    await user.click(rulesButton())

    expect(popup()).not.toBeNull()
  })

  test('pressing outside the popup closes it', async () => {
    fakeServer()
    openPath('/')
    const user = userEvent.setup()
    await user.click(rulesButton())

    // A press on the dimmed area is reported as a press on the dialog element itself.
    await user.click(popup()!)

    expect(popup()).toBeNull()
  })

  test('pressing inside the popup keeps it open', async () => {
    fakeServer()
    openPath('/')
    const user = userEvent.setup()
    await user.click(rulesButton())

    await user.click(screen.getByRole('heading', { name: 'How to play' }))

    expect(popup()).not.toBeNull()
  })

  test('a drag that starts inside and ends outside keeps it open', async () => {
    fakeServer()
    openPath('/')
    await userEvent.setup().click(rulesButton())

    // Selecting text and letting go outside produces a click on the dialog element.
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'How to play' }))
    fireEvent.click(popup()!)

    expect(popup()).not.toBeNull()
  })

  test.each([
    ['the Close button', () => fireEvent.click(closeButton())],
    ['a press outside', () => (fireEvent.pointerDown(popup()!), fireEvent.click(popup()!))],
    // Escape makes the browser call close() itself.
    ['the browser closing it, as Escape does', () => act(() => popup()!.close())],
  ])('after %s, focus returns to the Rules button', async (_name, close) => {
    await openGame(fakeServer(), game())
    // fireEvent.click doesn't move focus, like a click in Safari, so focus starts on the board.
    fireEvent.click(rulesButton())

    close()

    expect(popup()).toBeNull()
    expect(document.activeElement).toBe(rulesButton())
  })
})

const ghosts = () => document.querySelectorAll('[data-ghost]').length
const focusedColumn = () => columns().indexOf(document.activeElement as HTMLButtonElement)

describe('the game behind the rules', () => {
  const midGame = game({ rows: ['.......', '.......', '.......', '.......', '...Y...', '...R...'], moveCount: 2 })
  const afterNextMove = game({
    rows: ['.......', '.......', '.......', '...R...', '...Y...', '...R...'],
    currentPlayer: 'Y',
    moveCount: 3,
  })

  test('opening and closing sends nothing and changes nothing', async () => {
    const server = fakeServer()
    await openGame(server, midGame)
    const board = document.querySelector('.board')!.innerHTML
    const user = userEvent.setup()

    await user.click(rulesButton())
    await user.click(closeButton())

    expect(server.requests).toHaveLength(1)
    expect(document.querySelector('.board')!.innerHTML).toBe(board)
    expect(statusText()).toBe("Red's turn")
  })

  test('a move already sent still finishes, and the rules stay open', async () => {
    const server = fakeServer()
    await openGame(server, midGame)
    const slow = held()
    server.will(slow.answer)
    const user = userEvent.setup()
    await user.click(columns()[3])

    await user.click(rulesButton())
    await act(async () => slow.release(json(200, afterNextMove)))

    expect(popup()).not.toBeNull()
    expect(pieceAt(3, 3)).toBe('R')
    expect(statusText()).toBe("Yellow's turn")
  })

  test('the rules stay open when the game finishes loading', async () => {
    const server = fakeServer()
    const slow = held()
    server.will(slow.answer)
    openPath(`/game/${GAME_ID}`)
    await userEvent.setup().click(rulesButton())

    await act(async () => slow.release(json(200, midGame)))

    expect(popup()).not.toBeNull()
  })

  test.each([
    ['mouse', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.hover(columns()[3])
      await user.click(rulesButton())
    }],
    ['keyboard', async (user: ReturnType<typeof userEvent.setup>) => {
      await user.keyboard('{ArrowRight}')
      await user.tab({ shift: true })
      await user.keyboard('{Enter}')
    }],
  ])('no preview is left behind the rules (%s)', async (_name, openRules) => {
    await openGame(fakeServer(), midGame)

    await openRules(userEvent.setup())

    expect(popup()).not.toBeNull()
    expect(ghosts()).toBe(0)
  })

  test('keys pressed in the popup do not reach the board', async () => {
    const server = fakeServer()
    await openGame(server, midGame)
    const user = userEvent.setup()
    await user.click(rulesButton())
    closeButton().focus()

    await user.keyboard('{ArrowLeft}{ArrowRight}{ArrowRight}')

    expect(focusedColumn()).toBe(-1)
    expect(columns().map((column) => column.tabIndex).indexOf(0)).toBe(3)
    expect(ghosts()).toBe(0)
    expect(server.requests).toHaveLength(1)
  })
})

describe('what the rules say', () => {
  async function readRules() {
    fakeServer()
    openPath('/')
    await userEvent.setup().click(rulesButton())
    return popup()!
  }
  // Collapses line breaks and bold text into one plain sentence.
  const lines = (elements: NodeListOf<Element>) =>
    Array.from(elements, (element) => element.textContent!.replace(/\s+/g, ' ').trim())

  test('says who plays', async () => {
    const rules = await readRules()

    expect(lines(rules.querySelectorAll('p'))).toContain(
      'Connect 4 is a game for two players, Red and Yellow, who share one screen.',
    )
  })

  test('gives the four rules in order', async () => {
    const rules = await readRules()

    expect(lines(rules.querySelectorAll('ol li'))).toEqual([
      'Red goes first, then players take turns.',
      'Choose a column. Your piece falls to the lowest empty space.',
      'Get four or more in a row to win: across, up and down, or diagonally.',
      'If the board fills up and nobody has won, the game is a draw.',
    ])
  })

  test('explains full columns and rematches', async () => {
    const rules = await readRules()

    expect(lines(rules.querySelectorAll('p'))).toContain(
      "A full column can't be played. When a game ends, choose Play again to start a new one.",
    )
  })

  test('explains all three ways to play', async () => {
    const rules = await readRules()

    expect(screen.getByRole('heading', { name: 'Controls' })).toBeTruthy()
    expect(lines(rules.querySelectorAll('ul li'))).toEqual([
      'Mouse: point at a column to see where your piece will land, then click.',
      'Touch: tap a column to drop your piece.',
      "Keyboard: use the Left and Right arrows to choose a column, then press Enter or Space. If the board isn't selected, press Tab until it is.",
    ])
  })
})
