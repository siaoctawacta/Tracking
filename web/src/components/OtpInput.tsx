import { useEffect, useRef } from 'react'
import { cx } from './ui'

/** 6-box one-time-code input: auto-advance, backspace, paste, and SMS/WhatsApp autofill hints. */
export function OtpInput({ value, onChange, onComplete, disabled, error }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; error?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => refs.current[0]?.focus(), [])

  function set(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, 6)
    onChange(clean)
    refs.current[Math.min(clean.length, 5)]?.focus()
    if (clean.length === 6) onComplete?.(clean)
  }

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); set(e.clipboardData.getData('text')) }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          value={value[i] ?? ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          disabled={disabled}
          aria-label={`Chiffre ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (!v) return
            set((value.slice(0, i) + v).slice(0, 6))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              const at = value[i] ? i : Math.max(0, i - 1)
              onChange(value.slice(0, at))
              refs.current[at]?.focus()
            }
          }}
          className={cx(
            'h-14 w-full min-w-0 rounded-xl border bg-surface text-center text-2xl font-bold text-heading tabular-nums transition focus:outline-none focus:ring-4',
            error ? 'border-rose-300 focus:ring-rose-100' : 'border-line focus:border-brand focus:ring-brand/15',
          )}
        />
      ))}
    </div>
  )
}
