import { useCallback, useEffect, useRef } from 'react'

/** Lets a late response check that its screen is still showing before it acts. */
export function useIsMounted() {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return useCallback(() => mounted.current, [])
}
