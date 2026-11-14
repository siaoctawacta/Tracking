import { ArrowRight, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeTracking, TRACKING_RE } from '../lib/format'
import { cx } from './ui'

export function TrackingSearch({ initial = '', size = 'lg', autoFocus }: { initial?: string; size?: 'lg' | 'md'; autoFocus?: boolean }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function submit(e: FormEvent) {
    e.preventDefault()
    const id = normalizeTracking(value)
    if (!TRACKING_RE.test(id)) {
      setError('Format attendu : BC-2026-XXXXXX')
      return
    }
    setError('')
    navigate(`/suivi/${id}`)
  }

  const lg = size === 'lg'
  return (
    <form onSubmit={submit} role="search" className="w-full">
      <div
        className={cx(
          'group flex items-center gap-2 rounded-2xl border bg-white p-1.5 shadow-[0_8px_30px_-12px_rgba(18,30,49,0.18)] transition focus-within:border-electric focus-within:shadow-[0_8px_40px_-12px_rgba(30,144,255,0.35)]',
          error ? 'border-rose-300' : 'border-line',
        )}
      >
        <Search className={cx('ml-3 shrink-0 text-slate-400 transition group-focus-within:text-electric', lg ? 'size-5' : 'size-4')} />
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          placeholder="Numéro de suivi — ex : BC-2026-889X"
          aria-label="Numéro de suivi"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className={cx('min-w-0 flex-1 bg-transparent font-medium uppercase tracking-wide text-navy placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:outline-none', lg ? 'h-12 text-base' : 'h-10 text-sm')}
        />
        <button
          type="submit"
          className={cx('inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-electric font-semibold text-white transition hover:bg-electric-600 active:scale-[0.98]', lg ? 'h-12 px-5' : 'h-10 px-4 text-sm')}
        >
          <span className="hidden sm:inline">Suivre</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
      {error && <p className="mt-2 pl-2 text-left text-sm text-rose-600">{error}</p>}
    </form>
  )
}
