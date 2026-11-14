import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { isStaff, useAuth } from '../lib/auth'
import { site, waLink } from '../lib/site'
import { Logo, WhatsAppIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'
import { cx } from './ui'

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/#process', label: 'Fonctionnement' },
  { to: '/#tarifs', label: 'Tarifs' },
  { to: '/#agences', label: 'Agences' },
]

export function SiteHeader() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const space = user ? (isStaff(user) ? '/admin' : '/espace') : '/connexion'

  return (
    <header className={cx('sticky top-0 z-40 transition-all duration-300', scrolled || open ? 'border-b border-line/80 bg-canvas/85 backdrop-blur-xl' : 'border-b border-transparent')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="Accueil Benit Cargo"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/suivi" className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium transition hover:text-navy', isActive ? 'text-navy' : 'text-muted')}>Suivi</NavLink>
          {NAV.map((n) => (
            <a key={n.to} href={n.to} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-navy">{n.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link to={space} className="inline-flex h-9 items-center gap-2 rounded-xl bg-deep px-4 text-sm font-semibold text-white transition hover:bg-deep-800">
            {user ? <LayoutDashboard className="size-4" /> : <LogIn className="size-4" />}
            {user ? 'Mon espace' : 'Connexion'}
          </Link>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle className="size-10 w-10" />
          <button className="grid size-10 cursor-pointer place-items-center rounded-xl text-navy" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="animate-fade-up border-t border-line px-5 pb-6 pt-3 md:hidden">
          <nav className="flex flex-col">
            <Link to="/suivi" className="py-3 text-base font-medium text-navy">Suivi de colis</Link>
            {NAV.map((n) => <a key={n.to} href={n.to} className="py-3 text-base font-medium text-navy">{n.label}</a>)}
          </nav>
          <Link to={space} className="mt-4 flex h-12 items-center justify-center rounded-xl bg-deep font-semibold text-white">{user ? 'Mon espace' : 'Connexion'}</Link>
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Fret maritime et aérien entre la Chine et le Togo. De l’entrepôt de Guangzhou jusqu’à votre retrait à Lomé.</p>
        </div>
        <FooterCol title="Services" links={[['Fret maritime', '/#services'], ['Fret aérien', '/#services'], ['Tarifs', '/#tarifs'], ['Suivi de colis', '/suivi']]} />
        <FooterCol title="Agences" links={site.agencies.map((a) => [`${a.city}, ${a.country}`, '/#agences'] as [string, string])} />
        <div>
          <p className="text-sm font-semibold text-navy">Contact</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><a className="inline-flex items-center gap-2 hover:text-navy" href={waLink('Bonjour Benit Cargo,')} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-4" />WhatsApp</a></li>
            <li><a className="hover:text-navy" href={`mailto:${site.email}`}>{site.email}</a></li>
            <li>{site.phoneLome}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Benit Cargo. Tous droits réservés.</p>
          <p>Guangzhou · Lomé</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {links.map(([l, h]) => <li key={l}><a href={h} className="hover:text-navy">{l}</a></li>)}
      </ul>
    </div>
  )
}

export function SiteLayout() {
  const { hash, pathname } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo(0, 0)
  }, [hash, pathname])
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1"><Outlet /></main>
      <SiteFooter />
    </div>
  )
}
