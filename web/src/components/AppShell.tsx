import { LogOut } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/format'
import { Logo } from './icons'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { cx } from './ui'

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

export function UserChip() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{initials}</span>
      <div className="hidden leading-tight sm:block">
        <p className="text-sm font-semibold text-heading">{user.name}</p>
        <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        onClick={async () => { await logout(); navigate('/connexion') }}
        className="ml-1 grid size-9 cursor-pointer place-items-center rounded-xl text-muted transition hover:bg-slate-100 hover:text-heading"
        aria-label="Se déconnecter" title="Se déconnecter"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}

/** Top-bar shell for the client space. */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/espace"><Logo /></Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/espace/compte" className={({ isActive }) => cx('hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:inline-flex', isActive ? 'text-brand' : 'text-muted hover:text-heading')}>Mon compte</NavLink>
            <ThemeToggle />
            <UserChip />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  )
}

function useIsDesktop() {
  const query = '(min-width: 768px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

/** Sidebar shell for staff. Collapses into a bottom tab bar on mobile. */
export function StaffShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  // A single bell instance (one poller, one chime): in the sidebar on desktop, in the header on mobile.
  const desktop = useIsDesktop()
  return (
    <div className="min-h-dvh md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center justify-between pl-6 pr-4"><Link to="/admin"><Logo compact /></Link>{desktop && <NotificationBell placement="left" />}</div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-slate-50 hover:text-heading')}>
              {n.icon}{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <ThemeToggle withLabel className="w-full justify-start" />
          <UserChip />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/85 px-5 backdrop-blur-xl md:hidden">
        <Link to="/admin"><Logo /></Link>
        <div className="flex items-center gap-1">{!desktop && <NotificationBell />}<ThemeToggle /><UserChip /></div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:px-10 md:pb-12 md:pt-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted')}>
            {n.icon}{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({ title, text, actions, back }: { title: ReactNode; text?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-8">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading md:text-3xl">{title}</h1>
          {text && <p className="mt-1.5 text-sm text-muted">{text}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-heading">← {label}</Link>
}
