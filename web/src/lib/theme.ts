import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'kc-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const current = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

const listeners = new Set<() => void>()
function apply(theme: Theme, animate: boolean) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
  }
  root.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#140b0e' : '#fbf8f9')
  listeners.forEach((l) => l())
}

/** Theme state shared by every toggle on the page. An explicit choice is remembered; otherwise the OS setting is followed. */
export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => 'light' as Theme,
  )

  useEffect(() => {
    const mq = media()
    const onChange = () => { if (!stored()) apply(mq.matches ? 'dark' : 'light', true) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(KEY, next) } catch { /* private mode: still switch for this page */ }
    apply(next, true)
  }, [])

  return { theme, toggle }
}
