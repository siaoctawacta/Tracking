import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'dark' | 'ghost' | 'outline' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-electric text-white hover:bg-electric-600 shadow-sm shadow-electric/25',
  dark: 'bg-navy text-white hover:bg-navy-800',
  ghost: 'text-ink hover:bg-slate-100',
  outline: 'border border-line bg-white text-ink hover:border-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }>(
  function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
    const sizes = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-13 px-6 text-base' }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          variants[variant], sizes[size], className,
        )}
        {...rest}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    )
  },
)

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  function Input({ label, hint, error, className, id, ...rest }, ref) {
    const inputId = id ?? rest.name
    return (
      <label htmlFor={inputId} className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cx(
            'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink placeholder:text-slate-400 transition focus:outline-none focus:ring-4',
            error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-line focus:border-electric focus:ring-electric/15',
            className,
          )}
          {...rest}
        />
        {(error || hint) && <span className={cx('mt-1.5 block text-xs', error ? 'text-rose-600' : 'text-muted')}>{error || hint}</span>}
      </label>
    )
  },
)

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>}
      <select
        className={cx('h-11 w-full cursor-pointer rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15', className)}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white', className)}>{children}</div>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-electric', className)} />
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-electric-50 text-electric">{icon}</div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const t = { error: 'bg-rose-50 text-rose-700 border-rose-100', success: 'bg-emerald-50 text-emerald-700 border-emerald-100', info: 'bg-electric-50 text-navy border-electric/15' }
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm', t[tone])}>{children}</div>
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  )
}
