import { Check, Clock3, MapPin, PackageCheck, Plane, Ship, Warehouse, Container as Box, Anchor, Hand } from 'lucide-react'
import { dateShort, dateTime, STATUSES, STATUS_SHORT, stepLabel } from '../lib/format'
import type { Mode, Status, TimelineEvent } from '../lib/types'
import { cx } from './ui'

const TONE: Record<Status, string> = {
  REGISTERED: 'bg-slate-100 text-slate-700',
  LOADING: 'bg-amber-50 text-amber-700',
  IN_TRANSIT: 'bg-electric-50 text-electric-600',
  ARRIVED: 'bg-indigo-50 text-indigo-700',
  READY: 'bg-emerald-50 text-emerald-700',
  DELIVERED: 'bg-deep text-white dark:bg-slate-700 dark:text-canvas',
}

export function StatusBadge({ status, label, className }: { status: Status; label?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONE[status], className)}>
      <span className={cx('size-1.5 rounded-full bg-current', status === 'IN_TRANSIT' && 'animate-pulse')} />
      {label ?? STATUS_SHORT[status]}
    </span>
  )
}

export function ModeIcon({ mode, className = 'size-4' }: { mode: Mode; className?: string }) {
  return mode === 'AIR' ? <Plane className={className} /> : <Ship className={className} />
}

export const modeLabel = (m: Mode) => (m === 'AIR' ? 'Aérien' : 'Maritime')

function stepIcon(s: Status, mode: Mode) {
  const c = 'size-4'
  switch (s) {
    case 'REGISTERED': return <Warehouse className={c} />
    case 'LOADING': return <Box className={c} />
    case 'IN_TRANSIT': return <ModeIcon mode={mode} className={c} />
    case 'ARRIVED': return mode === 'AIR' ? <Plane className={c} /> : <Anchor className={c} />
    case 'READY': return <PackageCheck className={c} />
    case 'DELIVERED': return <Hand className={c} />
  }
}

/** Visual progress Guangzhou → Lomé. Horizontal on desktop, vertical on mobile. */
export function StatusStepper({ status, mode, events = [] }: { status: Status; mode: Mode; events?: TimelineEvent[] }) {
  const current = STATUSES.indexOf(status)
  const reachedAt = (s: Status) => {
    const e = events.find((ev) => ev.status === s)
    return e ? (e.at ?? e.createdAt) : undefined
  }
  const pct = (current / (STATUSES.length - 1)) * 100

  return (
    <div>
      {/* Desktop */}
      <div className="relative hidden md:block">
        <div className="absolute inset-x-[8.33%] top-5 h-0.5 rounded bg-line" />
        <div
          className="absolute left-[8.33%] top-5 h-0.5 rounded bg-electric transition-[width] duration-1000 ease-out-soft"
          style={{ width: `calc(${pct}% * 0.8334)` }}
        />
        <ol className="relative grid grid-cols-6">
          {STATUSES.map((s, i) => {
            const done = i < current
            const active = i === current
            return (
              <li key={s} className="flex flex-col items-center text-center">
                <span
                  className={cx(
                    'relative grid size-10 place-items-center rounded-full border-2 transition-colors duration-500',
                    done && 'border-electric bg-electric text-white',
                    active && 'border-electric bg-surface text-electric shadow-[0_0_0_6px_rgba(30,144,255,0.12)]',
                    !done && !active && 'border-line bg-surface text-slate-300',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : stepIcon(s, mode)}
                  {active && <span className="absolute inset-0 animate-ping rounded-full border-2 border-electric/40" />}
                </span>
                <span className={cx('mt-3 text-[13px] font-semibold leading-tight', i <= current ? 'text-navy' : 'text-slate-400')}>{stepLabel(s, mode)}</span>
                <span className="mt-1 text-xs text-muted">{i <= current ? dateShort(reachedAt(s)) : ' '}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Mobile */}
      <ol className="md:hidden">
        {STATUSES.map((s, i) => {
          const done = i < current
          const active = i === current
          const last = i === STATUSES.length - 1
          return (
            <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && <span className={cx('absolute left-[17px] top-9 bottom-0 w-0.5', i < current ? 'bg-electric' : 'bg-line')} />}
              <span
                className={cx(
                  'relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2',
                  done && 'border-electric bg-electric text-white',
                  active && 'border-electric bg-surface text-electric shadow-[0_0_0_5px_rgba(30,144,255,0.12)]',
                  !done && !active && 'border-line bg-surface text-slate-300',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : stepIcon(s, mode)}
              </span>
              <div className="pt-1.5">
                <p className={cx('text-sm font-semibold', i <= current ? 'text-navy' : 'text-slate-400')}>{stepLabel(s, mode)}</p>
                {i <= current && <p className="text-xs text-muted">{dateShort(reachedAt(s))}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Detailed, newest-first event history. */
export function EventHistory({ events, showAuthor = false }: { events: TimelineEvent[]; showAuthor?: boolean }) {
  const list = [...events].reverse()
  return (
    <ol className="space-y-0">
      {list.map((e, i) => (
        <li key={e.id ?? i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < list.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-line" />}
          <span className={cx('relative mt-1.5 size-[11px] shrink-0 rounded-full border-2', i === 0 ? 'border-electric bg-electric' : 'border-slate-300 bg-surface')} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className={cx('text-sm font-semibold', i === 0 ? 'text-navy' : 'text-ink')}>{e.label}</p>
              <p className="flex items-center gap-1 text-xs text-muted"><Clock3 className="size-3" />{dateTime(e.at ?? e.createdAt)}</p>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{e.location}</p>
            {e.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink">{e.note}</p>}
            {showAuthor && e.createdBy && <p className="mt-1 text-xs text-slate-400">par {e.createdBy.name}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
