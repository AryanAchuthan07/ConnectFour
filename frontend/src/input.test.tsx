import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { fakeServer, held, json } from './test/fakeServer'
import { game } from './test/games'
import { columns, openGame } from './test/screen'

const ROW = '.......'
// Column 1 is full. Column 4 holds two pieces, so the next one lands in row 3.
const rows = ['R......', 'Y......', 'R......', 'Y......', 'R..Y...', 'Y..R...']
const midGame = game({ rows, moveCount: 8 })
const afterRedInColumn4 = game({
  rows: ['R......', 'Y......', 'R......', 'Y..R...', 'R..Y...', 'Y..R...'],
  currentPlayer: 'Y',
  moveCount: 9,
})

/** Every preview piece showing, as "row,col colour". */
const ghosts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-ghost]')).map(
    (cell) => `${cell.dataset.cell} ${cell.dataset.ghost}`,
  )
const focusedColumn = () => columns().indexOf(document.activeElement as HTMLButtonElement)
const tabStops = () => columns().map((column) => column.tabIndex)

async function open(loaded = midGame) {
  const server = fakeServer()
  await openGame(server, loaded)
  return { server, user: userEvent.setup() }
}

describe('keyboard', () => {
  test('the middle column is focused when the game opens, with no preview yet', async () => {
    await open()

    expect(focusedColumn()).toBe(3)
    expect(tabStops()).toEqual([-1, -1, -1, 0, -1, -1, -1])
    expect(ghosts()).toEqual([])
  })

  test('Left and Right move between columns and move the preview with them', async () => {
    const { user } = await open()

    await user.keyboard('{ArrowRight}')
    expect(focusedColumn()).toBe(4)
    expect(ghosts()).toEqual(['5,4 R'])

    await user.keyboard('{ArrowLeft}')
    expect(focusedColumn()).toBe(3)
    expect(ghosts()).toEqual(['3,3 R'])
    expect(tabStops()).toEqual([-1, -1, -1, 0, -1, -1, -1])
  })

  test('the arrows stop at the edges', async () => {
    const { user } = await open()

    await user.keyboard('{ArrowRight>9/}')
    expect(focusedColumn()).toBe(6)
    await user.keyboard('{ArrowLeft>9/}')
    expect(focusedColumn()).toBe(0)
  })

  test('a full column can be reached but shows no preview and takes no move', async () => {
    const { server, user } = await open()

    await user.keyboard('{ArrowLeft>3/}{Enter}')

    expect(focusedColumn()).toBe(0)
    expect(ghosts()).toEqual([])
    expect(server.requests).toHaveLength(1)
  })

  test('the arrows do not also scroll the page', async () => {
    await open()

    // fireEvent returns false when the default action was cancelled.
    expect(fireEvent.keyDown(columns()[3], { key: 'ArrowRight' })).toBe(false)
  })

  test.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s drops a piece in the focused column', async (_name, key) => {
    const { server, user } = await open()
    server.will(json(200, afterRedInColumn4))

    await user.keyboard(key)

    expect(server.requests[1].body).toEqual({ column: 3, moveCount: 8 })
  })

  test.each(['Enter', ' '])('holding %j down does not repeat the move', async (key) => {
    await open()

    expect(fireEvent.keyDown(columns()[3], { key, repeat: true })).toBe(false)
    expect(fireEvent.keyDown(columns()[3], { key, repeat: false })).toBe(true)
  })

  test('focus stays put while waiting, then the preview shows the next player', async () => {
    const { server, user } = await open()
    const slow = held()
    server.will(slow.answer)

    await user.keyboard('{Enter}')
    expect(focusedColumn()).toBe(3)
    expect(ghosts()).toEqual([])
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(focusedColumn()).toBe(3)
    expect(ghosts()).toEqual(['2,3 Y'])
  })

  test('Tab enters the board once, on the last column used, and shows its preview', async () => {
    const { user } = await open()
    await user.keyboard('{ArrowRight}')

    await user.tab()
    expect(focusedColumn()).toBe(-1)
    expect(ghosts()).toEqual([])

    await user.tab({ shift: true })
    expect(focusedColumn()).toBe(4)
    expect(ghosts()).toEqual(['5,4 R'])
  })
})

describe('mouse', () => {
  test('hovering shows where the piece would land, and leaving removes it', async () => {
    const { user } = await open()

    await user.hover(columns()[3])
    expect(ghosts()).toEqual(['3,3 R'])
    await user.hover(columns()[6])
    expect(ghosts()).toEqual(['5,6 R'])
    await user.unhover(columns()[6])

    expect(ghosts()).toEqual([])
  })

  test('a full column shows no preview', async () => {
    const { user } = await open()

    await user.hover(columns()[0])

    expect(ghosts()).toEqual([])
  })

  test('clicking drops the piece, and the preview returns for the next player', async () => {
    const { server, user } = await open()
    const slow = held()
    server.will(slow.answer)

    await user.click(columns()[3])
    expect(server.requests[1].body).toEqual({ column: 3, moveCount: 8 })
    expect(ghosts()).toEqual([])
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(ghosts()).toEqual(['2,3 Y'])
  })

  test('a finished game shows no preview', async () => {
    const won = game({
      rows: [ROW, ROW, ROW, ROW, 'YYY....', 'RRRR...'],
      status: 'red_won',
      winningCells: [[5, 0], [5, 1], [5, 2], [5, 3]],
      moveCount: 7,
    })
    const { user } = await open(won)

    await user.hover(columns()[6])
    await user.keyboard('{ArrowRight}')

    expect(ghosts()).toEqual([])
  })

  test('whichever of mouse and keyboard was used last decides the preview', async () => {
    const { user } = await open()

    await user.hover(columns()[6])
    await user.keyboard('{ArrowRight}')
    expect(ghosts()).toEqual(['5,4 R'])
    await user.hover(columns()[1])

    expect(ghosts()).toEqual(['5,1 R'])
  })
})

describe('touch', () => {
  test('one tap makes the move, with no preview before, during or after', async () => {
    const { server, user } = await open()
    const slow = held()
    server.will(slow.answer)

    await user.pointer({ keys: '[TouchA]', target: columns()[3] })
    expect(server.requests[1].body).toEqual({ column: 3, moveCount: 8 })
    expect(ghosts()).toEqual([])
    await act(async () => slow.release(json(200, afterRedInColumn4)))

    expect(screen.getByRole('status').textContent).toBe("Yellow's turn")
    expect(ghosts()).toEqual([])
  })

  test('a tap clears a preview left by the keyboard', async () => {
    const { server, user } = await open()
    await user.keyboard('{ArrowRight}')
    server.will(json(200, afterRedInColumn4))

    await user.pointer({ keys: '[TouchA]', target: columns()[3] })

    expect(ghosts()).toEqual([])
  })
})

describe('the focus outline', () => {
  // The outline's style applies only while the board says the keyboard is in use.
  const outlineAllowed = () => screen.getByRole('group', { name: 'Game board' }).dataset.keyboard

  test('is off when the game opens, although the middle column has focus', async () => {
    await open()

    expect(focusedColumn()).toBe(3)
    expect(outlineAllowed()).toBe('false')
  })

  test.each([
    ['an arrow key', '{ArrowRight}'],
    ['Enter on a full column', '{ArrowLeft>3/}{Enter}'],
  ])('comes on with %s', async (_name, keys) => {
    const { user } = await open()

    await user.keyboard(keys)

    expect(outlineAllowed()).toBe('true')
  })

  test('comes on when Tab enters the board', async () => {
    const { user } = await open()
    await user.tab()

    await user.tab({ shift: true })

    expect(focusedColumn()).toBe(3)
    expect(outlineAllowed()).toBe('true')
  })

  test.each([
    ['the mouse', (user: ReturnType<typeof userEvent.setup>) => user.hover(columns()[1])],
    ['touch', (user: ReturnType<typeof userEvent.setup>) =>
      user.pointer({ keys: '[TouchA]', target: columns()[0] })],
  ])('goes off again with %s', async (_name, use) => {
    const { user } = await open()
    await user.keyboard('{ArrowRight}')

    await use(user)

    expect(outlineAllowed()).toBe('false')
  })
})
