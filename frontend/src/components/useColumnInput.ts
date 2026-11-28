import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const MIDDLE = 3
const LAST = 6

/**
 * Which column the keyboard is on and which one to preview. Mouse and keyboard show a preview,
 * whichever was used last. Touch never does. CSS :hover isn't used, because phones keep it
 * switched on after a tap.
 */
export function useColumnInput() {
  const [selected, setSelected] = useState(MIDDLE)
  const [source, setSource] = useState<'none' | 'keyboard' | 'mouse'>('none')
  const [hovered, setHovered] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // So the arrow keys work as soon as the game opens. No preview until a key is used.
  useEffect(() => {
    buttons.current[MIDDLE]?.focus({ preventScroll: true })
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const step = event.key === 'ArrowLeft' ? -1 : 1
      const next = Math.min(LAST, Math.max(0, selected + step))
      setSource('keyboard')
      setSelected(next)
      buttons.current[next]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      // A held key repeats. Cancelling the repeat stops it from making move after move.
      if (event.repeat) event.preventDefault()
      else setSource('keyboard')
    }
  }

  const pointer = (col: number) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      setSource('mouse')
      setHovered(col)
    } else {
      setSource('none')
    }
  }

  return {
    previewColumn: source === 'keyboard' ? selected : source === 'mouse' ? hovered : null,
    groupProps: {
      onKeyDown,
      // Tab's key-up happens on whatever it moved focus to.
      onKeyUp: (event: KeyboardEvent) => {
        if (event.key === 'Tab') setSource('keyboard')
      },
      onBlur: (event: React.FocusEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setSource((current) => (current === 'keyboard' ? 'none' : current))
        }
      },
    },
    columnProps: (col: number) => ({
      ref: (button: HTMLButtonElement | null) => {
        buttons.current[col] = button
      },
      // Only one column is in the Tab order, so Tab enters the board once.
      tabIndex: col === selected ? 0 : -1,
      onFocus: () => setSelected(col),
      onPointerEnter: pointer(col),
      onPointerMove: pointer(col),
      onPointerDown: pointer(col),
      onPointerLeave: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') setHovered(null)
      },
    }),
  }
}
