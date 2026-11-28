import { useRef, type MouseEvent, type PointerEvent } from 'react'

/** The Rules button and the popup it opens. It doesn't touch the game behind it. */
export function Rules() {
  const button = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)

  // The dimmed area around the popup belongs to the dialog element itself. Anything inside the
  // popup is a child of it. Both ends of the press must be outside, so that selecting text and
  // letting go outside doesn't close it.
  const notePress = (event: PointerEvent) => {
    pressedOutside.current = event.target === dialog.current
  }
  const closeIfOutside = (event: MouseEvent) => {
    if (pressedOutside.current && event.target === dialog.current) dialog.current.close()
    pressedOutside.current = false
  }

  function open() {
    if (!dialog.current) return
    dialog.current.showModal()
    // Otherwise it reopens wherever the player had scrolled to.
    dialog.current.scrollTop = 0
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="rules-button"
        aria-haspopup="dialog"
        onClick={open}
      >
        Rules
      </button>
      {/* A modal dialog blocks the page behind it and closes on Escape, without extra code. */}
      <dialog
        ref={dialog}
        className="rules"
        aria-labelledby="rules-title"
        // Safari doesn't focus a clicked button, so the browser can't be relied on to return here.
        onClose={() => button.current?.focus()}
        onPointerDown={notePress}
        onClick={closeIfOutside}
      >
        <div className="rules-content">
          {/* Close sits at the top because the browser focuses the popup's first button and
              scrolls to it. At the bottom, the rules would open already scrolled down. */}
          <div className="rules-header">
            <h2 id="rules-title">How to play</h2>
            <button type="button" className="button" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <p>
            Connect 4 is a game for two players, <strong>Red</strong> and <strong>Yellow</strong>, who
            share one screen.
          </p>
          <ol>
            <li>Red goes first, then players take turns.</li>
            <li>Choose a column. Your piece falls to the lowest empty space.</li>
            <li>
              Get <strong>four or more in a row</strong> to win: across, up and down, or diagonally.
            </li>
            <li>If the board fills up and nobody has won, the game is a draw.</li>
          </ol>
          <p>
            A full column can&apos;t be played. When a game ends, choose <strong>Play again</strong> to
            start a new one.
          </p>
          <h3>Controls</h3>
          <ul>
            <li>
              <strong>Mouse:</strong> point at a column to see where your piece will land, then click.
            </li>
            <li>
              <strong>Touch:</strong> tap a column to drop your piece.
            </li>
            <li>
              <strong>Keyboard:</strong> use the Left and Right arrows to choose a column, then press
              Enter or Space. If the board isn&apos;t selected, press Tab until it is.
            </li>
          </ul>
        </div>
      </dialog>
    </>
  )
}
