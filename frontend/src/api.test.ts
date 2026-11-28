import { describe, expect, test, vi } from 'vitest'
import { ApiError, createGame, getGame, makeMove } from './api'
import { apiError, fakeServer, htmlPage, json, networkFailure, neverAnswers } from './test/fakeServer'
import { GAME_ID, game } from './test/games'

const CANT_REACH = "Can't reach the server. Please try again."

async function failureOf(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.then(
    () => {
      throw new Error('expected the request to fail')
    },
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('requests', () => {
  test('createGame posts with no body and returns the game', async () => {
    const server = fakeServer()
    server.will(json(201, game()))

    await expect(createGame()).resolves.toEqual(game())

    expect(server.requests).toEqual([{ method: 'POST', url: '/api/games', body: undefined }])
  })

  test('getGame loads one game', async () => {
    const server = fakeServer()
    server.will(json(200, game()))

    await expect(getGame(GAME_ID)).resolves.toEqual(game())

    expect(server.requests).toEqual([{ method: 'GET', url: `/api/games/${GAME_ID}`, body: undefined }])
  })

  test('getGame keeps an odd ID inside its own part of the path', async () => {
    const server = fakeServer()
    server.will(apiError(400, 'INVALID_REQUEST', "That request wasn't valid."))

    await failureOf(getGame('../healthz?x'))

    expect(server.requests[0].url).toBe('/api/games/..%2Fhealthz%3Fx')
  })

  test('makeMove sends the column and move count as numbers', async () => {
    const server = fakeServer()
    server.will(json(200, game({ moveCount: 8 })))

    await makeMove(GAME_ID, 3, 7)

    expect(server.requests).toEqual([
      { method: 'POST', url: `/api/games/${GAME_ID}/moves`, body: { column: 3, moveCount: 7 } },
    ])
  })
})

describe('failures', () => {
  test("a server error keeps the server's message, code and status", async () => {
    fakeServer().will(apiError(409, 'COLUMN_FULL', 'That column is full.'))

    const error = await failureOf(makeMove(GAME_ID, 0, 6))

    expect(error).toMatchObject({ message: 'That column is full.', code: 'COLUMN_FULL', status: 409 })
  })

  test.each([
    ['a network failure', networkFailure, null],
    ['an nginx 502 page', htmlPage(502), 502],
    ['an nginx 504 page', htmlPage(504), 504],
    ['a web page where a game should be', htmlPage(200), 200],
    ['JSON that is not a game', json(200, { status: 'ok' }), 200],
    ['an error without a message', json(500, { error: {} }), 500],
  ])('%s says the server cannot be reached', async (_name, answer, status) => {
    fakeServer().will(answer)

    const error = await failureOf(getGame(GAME_ID))

    expect(error).toMatchObject({ message: CANT_REACH, code: null, status })
  })

  test('a request is abandoned after 20 seconds', async () => {
    vi.useFakeTimers()
    fakeServer().will(neverAnswers)
    let settled = false
    const failure = failureOf(getGame(GAME_ID)).finally(() => (settled = true))

    await vi.advanceTimersByTimeAsync(19_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await failure).toMatchObject({ message: CANT_REACH, status: null })
  })
})

describe('which failures call for reloading the game', () => {
  test.each([
    [409, true],
    [500, true],
    [502, true],
    [null, true],
    [400, false],
    [404, false],
  ])('a server message with status %s: %s', (status, expected) => {
    expect(new ApiError('message', status, status === null ? null : 'SOME_CODE').shouldReload).toBe(expected)
  })

  test('an unreadable response always does, whatever its status', () => {
    expect(new ApiError(CANT_REACH, 404, null).shouldReload).toBe(true)
  })
})
