import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { isStaff, useAuth } from '../lib/auth'
import { byPerson, site, telLink, waLink } from '../lib/site'
import { Logo, WhatsAppIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'
import { cx } from './ui'

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/#destinations', label: 'Destinations' },
  { to: '/#tarifs', label: 'Tarifs' },
  { to: '/#contact', label: 'Contact' },
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
        <Link to="/" aria-label="Accueil Kader Cargo"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/suivi" className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium transition hover:text-heading', isActive ? 'text-heading' : 'text-muted')}>Suivi</NavLink>
          {NAV.map((n) => (
            <a key={n.to} href={n.to} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-heading">{n.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {!user && <Link to="/inscription" className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-brand transition hover:bg-brand-50">Créer un compte</Link>}
          <Link to={space} className="inline-flex h-9 items-center gap-2 rounded-xl bg-deep px-4 text-sm font-semibold text-white transition hover:bg-deep-800">
            {user ? <LayoutDashboard className="size-4" /> : <LogIn className="size-4" />}
            {user ? 'Mon espace' : 'Connexion'}
          </Link>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle className="size-10 w-10" />
          <button className="grid size-10 cursor-pointer place-items-center rounded-xl text-heading" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="animate-fade-up border-t border-line px-5 pb-6 pt-3 md:hidden">
          <nav className="flex flex-col">
            <Link to="/suivi" className="py-3 text-base font-medium text-heading">Suivi de colis</Link>
            {NAV.map((n) => <a key={n.to} href={n.to} className="py-3 text-base font-medium text-heading">{n.label}</a>)}
          </nav>
          <Link to={space} className="mt-4 flex h-12 items-center justify-center rounded-xl bg-deep font-semibold text-white">{user ? 'Mon espace' : 'Connexion'}</Link>
          {!user && <Link to="/inscription" className="mt-2 flex h-12 items-center justify-center rounded-xl border border-line font-semibold text-brand">Créer un compte</Link>}
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div>
          <Logo tagline />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Fret aérien express de Guangzhou à Lomé. Livraison porte-à-porte à Lomé, Accra, Abidjan, Cotonou et Niamey.</p>
        </div>
        <FooterCol title="Services" links={[['Fret aérien express', '/#services'], ['Fret maritime', '/#services'], ['Tarifs', '/#tarifs'], ['Suivi de colis', '/suivi']]} />
        <FooterCol title="Destinations" links={site.destinations.map((d) => [`${d.city}, ${d.country}`, '/#destinations'] as [string, string])} />
        <div>
          <p className="text-sm font-semibold text-heading">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>
              <a className="inline-flex items-center gap-2 font-semibold text-emerald-600 hover:text-emerald-700" href={waLink('Bonjour Kader Cargo,')} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-4" />{site.whatsappDisplay}
              </a>
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lomé</p>
              {site.lome.contacts.map((c) => <a key={c.phone} href={telLink(c.phone)} className="block tabular-nums hover:text-heading">{c.phone} · {c.name}</a>)}
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Guangzhou</p>
              {byPerson(site.guangzhou.contacts).map((p) => <a key={p.name} href={telLink(p.phones[0])} className="block tabular-nums hover:text-heading">{p.phones[0]} · {p.name}</a>)}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Kader Cargo. Tous droits réservés.</p>
          <p lang="zh-CN">{site.guangzhou.addressZh}</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-heading">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {links.map(([l, h]) => <li key={l}><a href={h} className="hover:text-heading">{l}</a></li>)}
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
