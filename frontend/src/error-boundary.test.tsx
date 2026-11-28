import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ErrorBoundary } from './components/ErrorBoundary'

function Broken(): never {
  throw new Error('broken on purpose')
}

describe('if the interface itself crashes', () => {
  test('shows a message and a reload button, not a blank screen', async () => {
    // React and the boundary both log the crash. Keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    render(
      <ErrorBoundary reload={reload}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledOnce()
  })

  test('shows its contents while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>All fine</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('All fine')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
  })
})
