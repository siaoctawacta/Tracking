import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { cx } from './ui'

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Passer en mode clair' : 'Passer en mode sombre'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className={cx(
        'group inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl text-muted transition hover:bg-slate-100 hover:text-navy',
        withLabel ? 'px-3 text-sm font-medium' : 'w-9 justify-center',
        className,
      )}
    >
      <span className="relative grid size-[18px] place-items-center">
        <Sun className={cx('absolute size-[18px] transition-all duration-500', dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
        <Moon className={cx('absolute size-[18px] transition-all duration-500', dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} />
      </span>
      {withLabel && <span>{dark ? 'Mode clair' : 'Mode sombre'}</span>}
    </button>
  )
}
