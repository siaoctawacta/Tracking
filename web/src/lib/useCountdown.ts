import { useEffect, useState } from 'react'

/** Seconds left before a code can be re-sent. `restart()` starts a new countdown. */
export function useCountdown(seconds = 60) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return { left, restart: () => setLeft(seconds) }
}
