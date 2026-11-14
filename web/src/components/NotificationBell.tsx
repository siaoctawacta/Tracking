import { AlertTriangle, Bell, BellRing, Plane, PlaneLanding, Ship, UserPlus, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { relative } from '../lib/format'
import { armAudio, playChime } from '../lib/sound'
import type { StaffNotification, StaffNotificationType } from '../lib/types'
import { cx } from './ui'

const POLL_MS = 10_000
const SOUND_KEY = 'kc-sound'

const ICON: Record<StaffNotificationType, { icon: React.ReactNode; tone: string; loud: boolean }> = {
  ACCOUNT_PENDING: { icon: <UserPlus className="size-4" />, tone: 'bg-brand-50 text-brand', loud: true },
  CONTAINER_DEPARTED: { icon: <Plane className="size-4" />, tone: 'bg-indigo-50 text-indigo-700', loud: false },
  CONTAINER_ARRIVED: { icon: <Ship className="size-4" />, tone: 'bg-emerald-50 text-emerald-700', loud: true },
  SHIPMENT_ARRIVED: { icon: <PlaneLanding className="size-4" />, tone: 'bg-emerald-50 text-emerald-700', loud: true },
  WHATSAPP_FAILED: { icon: <AlertTriangle className="size-4" />, tone: 'bg-rose-50 text-rose-700', loud: true },
}

function soundPref() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

/**
 * Back-office notifications: polls the feed, rings a chime and shows a toast for every new event
 * (new client account to validate, container departed/arrived, parcel arrived, WhatsApp failure),
 * and raises a desktop notification when the tab is in the background (if allowed).
 */
export function NotificationBell({ placement = 'right' }: { placement?: 'left' | 'right' }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<StaffNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [sound, setSound] = useState(soundPref)
  const [toasts, setToasts] = useState<StaffNotification[]>([])
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const cursor = useRef<string | null>(null)
  const seen = useRef(new Set<string>())
  const inFlight = useRef(false)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => armAudio(), [])

  const announce = useCallback((fresh: StaffNotification[]) => {
    if (soundRef.current) playChime(fresh.some((n) => ICON[n.type]?.loud) ? 'alert' : 'info')
    setToasts((t) => [...fresh.slice(0, 3), ...t].slice(0, 3))
    for (const n of fresh) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 7000)
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      for (const n of fresh.slice(0, 3)) {
        const note = new Notification(n.title, { body: n.body, icon: '/apple-touch-icon.png', tag: n.id })
        note.onclick = () => { window.focus(); if (n.link) navigate(n.link) }
      }
    }
  }, [navigate])

  const poll = useCallback(async () => {
    if (inFlight.current) return // never overlap polls (interval + tab focus + dev double effects)
    inFlight.current = true
    try {
      const qs = cursor.current ? `?after=${encodeURIComponent(cursor.current)}` : ''
      const r = await api.get<{ notifications: StaffNotification[]; unread: number; serverTime: string }>(`/staff/notifications${qs}`)
      const first = cursor.current === null
      cursor.current = r.serverTime
      setUnread(r.unread)
      const fresh = r.notifications.filter((n) => !seen.current.has(n.id))
      fresh.forEach((n) => seen.current.add(n.id))
      if (first) setItems(r.notifications)
      else if (fresh.length) {
        setItems((prev) => [...fresh, ...prev].slice(0, 50))
        announce(fresh) // each event rings once, even if it shows up in two responses
      }
    } catch { /* offline or session ended: try again on the next tick */ } finally {
      inFlight.current = false
    }
  }, [announce])

  useEffect(() => {
    void poll()
    const t = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => { if (!document.hidden) void poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [poll])

  // "(3) Kader Cargo" in the tab title while something is unread.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = unread ? `(${unread}) ${base}` : base
  }, [unread])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread) {
      setUnread(0)
      await api.post('/staff/notifications/read').catch(() => undefined)
    }
    if (!next) setItems((list) => list.map((n) => ({ ...n, unread: false })))
  }

  function switchSound() {
    const next = !sound
    setSound(next)
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* private mode */ }
    if (next) playChime('info')
  }

  const go = (n: StaffNotification) => { setOpen(false); setToasts((t) => t.filter((x) => x.id !== n.id)); if (n.link) navigate(n.link) }

  return (
    <div className="relative" ref={panel}>
      <button onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} aria-expanded={open}
        className="relative grid size-9 cursor-pointer place-items-center rounded-xl text-muted transition hover:bg-slate-100 hover:text-heading">
        {unread ? <BellRing className="size-[18px] text-brand" /> : <Bell className="size-[18px]" />}
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={cx('fixed inset-x-3 z-50 mt-2 animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/10 sm:absolute sm:inset-x-auto sm:w-96', 'top-14 sm:top-auto', placement === 'left' ? 'sm:left-0' : 'sm:right-0')}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold text-heading">Notifications</p>
            <button onClick={switchSound} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-canvas hover:text-heading" aria-pressed={sound}>
              {sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}{sound ? 'Son activé' : 'Son coupé'}
            </button>
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Aucune notification pour le moment.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => go(n)} className={cx('flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition hover:bg-canvas', n.unread && 'bg-brand-50/50')}>
                  <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', ICON[n.type]?.tone)}>{ICON[n.type]?.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug text-heading">{n.title}</span>
                      {n.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{relative(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {perm === 'default' && (
            <button onClick={async () => setPerm(await Notification.requestPermission())} className="w-full cursor-pointer border-t border-line px-4 py-3 text-left text-xs font-semibold text-brand hover:bg-canvas">
              Recevoir aussi les notifications du navigateur quand l’onglet est en arrière-plan
            </button>
          )}
        </div>
      )}

      {/* Toasts for events that just arrived */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((n) => (
          <div key={n.id} className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl shadow-black/10">
            <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', ICON[n.type]?.tone)}>{ICON[n.type]?.icon}</span>
            <button onClick={() => go(n)} className="min-w-0 flex-1 cursor-pointer text-left">
              <p className="text-sm font-semibold text-heading">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
            </button>
            <button onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))} className="cursor-pointer text-slate-400 hover:text-heading" aria-label="Fermer"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
