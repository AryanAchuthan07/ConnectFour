/**
 * True only for a 200 with the expected body. A 200 alone isn't enough: a missing
 * proxy rule would serve the app's own HTML page with a 200.
 */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/healthz', { signal })
    if (response.status !== 200) return false
    const body = await response.json()
    return body?.status === 'ok'
  } catch {
    return false
  }
}
