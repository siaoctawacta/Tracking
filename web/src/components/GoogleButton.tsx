import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; use_fedcm_for_prompt?: boolean }) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGsi() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('gsi')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

let optionsPromise: Promise<string | null> | null = null
/** Google client ID from the API (runtime config) — null when Google sign-in is not set up. */
export function useGoogleClientId() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    optionsPromise ??= api.get<{ google: { clientId: string } | null }>('/auth/options').then((r) => r.google?.clientId ?? null).catch(() => null)
    optionsPromise.then(setId)
  }, [])
  return id
}

/** Official "Sign in with Google" button. Renders nothing when Google sign-in is not configured. */
export function GoogleButton({ onCredential, text = 'continue_with' }: { onCredential: (credential: string) => void; text?: 'continue_with' | 'signin_with' | 'signup_with' }) {
  const clientId = useGoogleClientId()
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), use_fedcm_for_prompt: true })
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, { theme: theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text, locale: 'fr', width: ref.current.offsetWidth || 320 })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [clientId, theme, text])

  if (!clientId) return null
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
      <div ref={ref} className="flex min-h-11 justify-center" />
    </div>
  )
}
