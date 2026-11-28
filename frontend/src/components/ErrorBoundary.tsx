import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  reload?: () => void
}

/** Without this, a crash while drawing would leave a blank page. */
export class ErrorBoundary extends Component<Props, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  render() {
    if (!this.state.crashed) return this.props.children
    const reload = this.props.reload ?? (() => window.location.reload())
    return (
      <main className="screen">
        <p role="alert" className="error">
          Something went wrong.
        </p>
        <button type="button" className="button" onClick={reload}>
          Reload
        </button>
      </main>
    )
  }
}
