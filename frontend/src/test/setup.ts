import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no showModal() or close(). These only open, close and announce it. What makes a real
// popup modal (blocking the page, closing on Escape) has to be checked in a real browser.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
