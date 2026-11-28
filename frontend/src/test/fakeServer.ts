import { vi } from 'vitest'

/**
 * Stands in for the network. It's the only thing the frontend tests fake. Responses follow the
 * formats in docs/PRD.md. Each request takes the next queued answer.
 */
type Answer = () => Promise<Response>

export interface SentRequest {
  method: string
  url: string
  body: unknown
}

export function fakeServer() {
  const requests: SentRequest[] = []
  const answers: Answer[] = []

  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    requests.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    const answer = answers.shift()
    if (!answer) return Promise.reject(new Error(`Unexpected request: ${method} ${url}`))
    // Like the real fetch, give up when the caller aborts.
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      answer().then(resolve, reject)
    })
  })

  return {
    requests,
    /** Queue answers, in the order the requests will arrive. */
    will(...next: Answer[]) {
      answers.push(...next)
    },
  }
}

const respond = (status: number, body: string, type: string): Response =>
  new Response(body, { status, headers: { 'Content-Type': type } })

export const json =
  (status: number, body: unknown): Answer =>
  async () =>
    respond(status, JSON.stringify(body), 'application/json')

export const apiError = (status: number, code: string, message: string): Answer =>
  json(status, { error: { code, message } })

/** What nginx sends when no backend can answer. */
export const htmlPage =
  (status: number): Answer =>
  async () =>
    respond(status, `<html><body><h1>${status}</h1></body></html>`, 'text/html')

export const networkFailure: Answer = async () => {
  throw new TypeError('Failed to fetch')
}

export const neverAnswers: Answer = () => new Promise<Response>(() => {})

/** An answer the test releases when it chooses, to see what happens while waiting. */
export function held() {
  let release!: (answer: Answer) => void
  const released = new Promise<Answer>((resolve) => (release = resolve))
  const answer: Answer = () => released.then((next) => next())
  return { answer, release }
}
