import { ArrowRight, BadgeCheck, Camera, Check, Copy, FileText, MapPin, PackageSearch, Phone, Plane, Scale, Ship, Truck, Warehouse } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WhatsAppIcon } from '../components/icons'
import { TrackingSearch } from '../components/TrackingSearch'
import { cx } from '../components/ui'
import { fcfa } from '../lib/format'
import { byPerson, site, telLink, waLink, type Contact } from '../lib/site'

// Mirrors the API tariffs for the public estimator (the invoice amount is always computed server-side).
const TARIFFS = { SEA_PER_CBM: 250_000, AIR_PER_KG: 9_500, MIN_CHARGE: 10_000 }
const DEMO_ID = 'KC-2026-7KX9QA'

export default function Home() {
  return (
    <>
      <Hero />
      <Facts />
      <Services />
      <Destinations />
      <Process />
      <Pricing />
      <Contacts />
      <Cta />
    </>
  )
}

function Section({ id, eyebrow, title, text, children, className }: { id?: string; eyebrow: string; title: string; text?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('scroll-mt-20 py-20 md:py-28', className)}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-heading md:text-4xl">{title}</h2>
          {text && <p className="mt-4 text-base leading-relaxed text-muted">{text}</p>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(139,21,56,0.10),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-heading">
            <Plane className="size-3.5 text-brand" /> Express Air Cargo · Guangzhou → Lomé
          </span>
          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-heading sm:text-5xl md:text-6xl">
            De Guangzhou à Lomé,{' '}
            <span className="text-brand">suivi à chaque étape.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Fret aérien express depuis notre entrepôt de Guangzhou, livraison porte-à-porte à Lomé, Accra, Abidjan, Cotonou et Niamey. Une alerte WhatsApp à chaque étape.
          </p>
          <div className="mt-9 max-w-xl">
            <TrackingSearch />
            <p className="mt-3 pl-2 text-sm text-muted">
              Essayez&nbsp;: <Link to={`/suivi/${DEMO_ID}`} className="font-semibold text-heading underline decoration-line underline-offset-4 hover:decoration-brand">{DEMO_ID}</Link>
            </p>
          </div>
        </div>
        <RouteCard />
      </div>
    </section>
  )
}

/** Flies the airplane along the route with requestAnimationFrame (static when reduced motion is on). */
function useFlight(progress = 0.62, flyMs = 3500, holdMs = 1500) {
  const route = useRef<SVGPathElement>(null)
  const plane = useRef<SVGGElement>(null)
  useEffect(() => {
    const path = route.current
    const g = plane.current
    if (!path || !g) return
    const total = path.getTotalLength()
    const place = (t: number) => {
      const at = total * progress * t
      const p = path.getPointAtLength(at)
      const q = path.getPointAtLength(Math.min(total, at + 1))
      const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI
      g.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      place(1)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const e = (now - start) % (flyMs + holdMs)
      const t = Math.min(1, e / flyMs)
      place(1 - (1 - t) * (1 - t)) // ease-out
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progress, flyMs, holdMs])
  return { route, plane }
}

function RouteCard() {
  const { route, plane } = useFlight()
  return (
    <div className="animate-fade-up [animation-delay:120ms]">
      <div className="relative rounded-3xl border border-line bg-surface p-6 pb-14 shadow-[0_30px_80px_-40px_rgba(43,12,22,0.35)] md:p-8 md:pb-16">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Colis</p>
            <p className="mt-1 font-bold tracking-wide text-heading">{DEMO_ID}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">
            <span className="size-1.5 animate-pulse rounded-full bg-current" /> En vol
          </span>
        </div>

        <svg viewBox="0 0 320 120" className="mt-6 w-full" aria-hidden>
          <path ref={route} d="M24 92 C 110 -6, 210 -6, 296 92" fill="none" className="stroke-line" strokeWidth="2" strokeDasharray="4 6" />
          <path d="M24 92 C 110 -6, 210 -6, 296 92" fill="none" className="stroke-brand" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="62 100" />
          <circle cx="24" cy="92" r="6" className="fill-heading" />
          <circle cx="296" cy="92" r="6" className="fill-surface stroke-heading" strokeWidth="2.5" />
          <g ref={plane}>
            <circle r="11" className="fill-brand" opacity="0.15" />
            {/* Small airplane flying along the route (nose along +x) */}
            <path className="fill-brand" transform="rotate(90)" d="M0-7c1 0 1.6 1.3 1.6 2.7V-1l7.6 4.3v1.6L1.6 2.6v4.2l2.3 1.8v1.2L0 8.7l-3.9 1.1V8.6l2.3-1.8V2.6l-7.6 2.3V3.3L-1.6-1v-3.3C-1.6-5.7-1-7 0-7z" />
          </g>
        </svg>
        <div className="-mt-1 flex justify-between text-sm">
          <div>
            <p className="font-semibold text-heading">Guangzhou</p>
            <p className="text-xs text-muted">Chine · 9 nov.</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-heading">Lomé</p>
            <p className="text-xs text-muted">Togo · arrivée prévue</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
          {[['Mode', 'Aérien'], ['Poids', '12,5 kg'], ['Colis', '1']].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
              <p className="mt-1 text-sm font-semibold text-heading">{v}</p>
            </div>
          ))}
        </div>

        <div className="absolute -bottom-5 left-6 right-6 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg shadow-black/5 md:left-auto md:right-8 md:w-72">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><WhatsAppIcon className="size-4" /></span>
          <p className="text-xs leading-snug text-ink"><span className="font-semibold">Kader Cargo · WhatsApp</span><br />✈️ Votre colis a décollé de Guangzhou.</p>
        </div>
      </div>
    </div>
  )
}

function Facts() {
  const facts = [
    { icon: <Plane className="size-4" />, v: 'Express', l: 'Fret aérien' },
    { icon: <Truck className="size-4" />, v: 'Porte-à-porte', l: '5 villes d’Afrique de l’Ouest' },
    { icon: <MapPin className="size-4" />, v: '2 agences', l: 'Guangzhou & Lomé' },
    { icon: <WhatsAppIcon className="size-4" />, v: 'Chaque étape', l: 'Alertes WhatsApp' },
  ]
  return (
    <div className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-5 md:grid-cols-4 md:divide-x">
        {facts.map((f) => (
          <div key={f.l} className="flex items-center gap-3 py-6 md:justify-center">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">{f.icon}</span>
            <div>
              <p className="font-bold text-heading">{f.v}</p>
              <p className="text-xs text-muted">{f.l}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Services() {
  const extras = [
    { icon: <Camera className="size-5" />, t: 'Photos de contrôle', d: 'Chaque colis est photographié à la réception à Guangzhou.' },
    { icon: <BadgeCheck className="size-5" />, t: 'Dédouanement', d: 'Nous gérons les formalités à l’arrivée à Lomé.' },
    { icon: <WhatsAppIcon className="size-5" />, t: 'Alertes WhatsApp', d: 'Un message clair à chaque étape franchie, sans rien installer.' },
    { icon: <FileText className="size-5" />, t: 'Factures en ligne', d: 'Factures et historique disponibles dans votre espace client.' },
  ]
  return (
    <Section id="services" eyebrow="Services" title="L’express aérien, sans mauvaise surprise." text="Votre marchandise est réceptionnée, contrôlée et photographiée à Guangzhou, puis expédiée et suivie jusqu’à la remise.">
      <div className="grid gap-5 md:grid-cols-2">
        <ServiceCard dark icon={<Plane className="size-6" />} title="Fret aérien express" price={`${fcfa(TARIFFS.AIR_PER_KG)} / kg`} delay="7 – 10 jours" points={['Départs réguliers depuis Guangzhou', 'Électronique, échantillons, urgences', 'Livraison porte-à-porte']} />
        <ServiceCard icon={<Ship className="size-6" />} title="Fret maritime" price={`${fcfa(TARIFFS.SEA_PER_CBM)} / m³`} delay="45 – 60 jours" points={['Groupage dès 0,1 m³', 'Volumes et marchandises lourdes', 'Arrivée au Port Autonome de Lomé']} />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {extras.map((e) => (
          <div key={e.t} className="group rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
            <span className="grid size-10 place-items-center rounded-xl bg-canvas text-heading transition group-hover:bg-brand group-hover:text-white">{e.icon}</span>
            <p className="mt-5 font-semibold text-heading">{e.t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.d}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function ServiceCard({ icon, title, price, delay, points, dark }: { icon: ReactNode; title: string; price: string; delay: string; points: string[]; dark?: boolean }) {
  return (
    <div className={cx('rounded-3xl p-8 transition hover:-translate-y-0.5', dark ? 'bg-deep text-white' : 'border border-line bg-surface')}>
      <div className="flex items-start justify-between">
        <span className={cx('grid size-12 place-items-center rounded-2xl', dark ? 'bg-white text-brand' : 'bg-brand-50 text-brand')}>{icon}</span>
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', dark ? 'bg-white/10 text-white' : 'bg-canvas text-heading')}>{delay}</span>
      </div>
      <h3 className={cx('mt-8 text-2xl font-bold tracking-tight', dark ? 'text-white' : 'text-heading')}>{title}</h3>
      <p className={cx('mt-1 text-sm', dark ? 'text-white/70' : 'text-muted')}>À partir de <span className={cx('font-semibold', dark ? 'text-white' : 'text-heading')}>{price}</span></p>
      <ul className="mt-6 space-y-2.5">
        {points.map((p) => (
          <li key={p} className={cx('flex items-center gap-2.5 text-sm', dark ? 'text-white/85' : 'text-ink')}>
            <span className={cx('size-1.5 rounded-full', dark ? 'bg-white' : 'bg-brand')} /> {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Destinations() {
  return (
    <Section id="destinations" eyebrow="Porte-à-porte" title="De Guangzhou jusqu’à votre porte." text="Nous livrons au départ de Guangzhou vers cinq villes d’Afrique de l’Ouest." className="bg-surface">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {site.destinations.map((d) => (
          <div key={d.city} className={cx('rounded-2xl border p-5 transition hover:-translate-y-0.5', d.main ? 'border-brand bg-brand text-white' : 'border-line bg-canvas')}>
            <span className={cx('text-xs font-bold tracking-wider', d.main ? 'text-white/70' : 'text-muted')}>{d.code}</span>
            <p className={cx('mt-6 text-lg font-bold', d.main ? 'text-white' : 'text-heading')}>{d.city}</p>
            <p className={cx('text-sm', d.main ? 'text-white/80' : 'text-muted')}>{d.country}</p>
            {d.main && <p className="mt-3 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">Agence Kader Cargo</p>}
          </div>
        ))}
      </div>
    </Section>
  )
}

function Process() {
  const steps = [
    { icon: <Warehouse className="size-5" />, t: 'Livrez à Guangzhou', d: 'Votre fournisseur dépose la marchandise à notre entrepôt de Yuexiu avec votre nom et votre numéro WhatsApp.' },
    { icon: <PackageSearch className="size-5" />, t: 'Contrôle & numéro de suivi', d: 'Pesée, mesure, photos. Vous recevez votre numéro KC-… par WhatsApp.' },
    { icon: <Plane className="size-5" />, t: 'Expédition express', d: 'Votre colis part par avion. Un message WhatsApp à chaque étape.' },
    { icon: <BadgeCheck className="size-5" />, t: 'Retrait ou livraison', d: 'Après dédouanement, retrait à l’agence de Lomé ou livraison à votre porte.' },
  ]
  return (
    <Section id="process" eyebrow="Fonctionnement" title="Quatre étapes, zéro surprise.">
      <ol className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.t} className="bg-surface p-7">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-brand text-white">{s.icon}</span>
              <span className="text-sm font-bold text-slate-300">0{i + 1}</span>
            </div>
            <p className="mt-6 font-semibold text-heading">{s.t}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Pricing() {
  const [mode, setMode] = useState<'SEA' | 'AIR'>('AIR')
  const [qty, setQty] = useState('10')
  const n = Math.max(0, Number(qty.replace(',', '.')) || 0)
  const raw = mode === 'AIR' ? n * TARIFFS.AIR_PER_KG : n * TARIFFS.SEA_PER_CBM
  const price = n > 0 ? Math.max(TARIFFS.MIN_CHARGE, Math.round(raw / 100) * 100) : 0

  return (
    <Section id="tarifs" eyebrow="Tarifs" title="Un prix clair, calculé en un instant." text="L’aérien est facturé au kilo, le maritime au mètre cube. Pas de frais cachés : le montant de votre facture est celui affiché ici." className="bg-surface">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-3xl border border-line bg-canvas p-7 md:p-8">
          <div className="inline-flex rounded-xl bg-surface p-1">
            {(['AIR', 'SEA'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setQty(m === 'AIR' ? '10' : '1') }}
                className={cx('inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', mode === m ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-heading')}>
                {m === 'AIR' ? <Plane className="size-4" /> : <Ship className="size-4" />}
                {m === 'AIR' ? 'Aérien' : 'Maritime'}
              </button>
            ))}
          </div>
          <label className="mt-8 block">
            <span className="text-sm font-medium text-ink">{mode === 'AIR' ? 'Poids total (kg)' : 'Volume total (m³)'}</span>
            <div className="mt-2 flex items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
              <Scale className="size-5 text-slate-400" />
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="h-14 w-full bg-transparent px-3 text-xl font-semibold text-heading focus:outline-none" aria-label="Quantité" />
              <span className="text-sm font-semibold text-muted">{mode === 'AIR' ? 'kg' : 'm³'}</span>
            </div>
          </label>
          <p className="mt-3 text-xs text-muted">{mode === 'AIR' ? `${fcfa(TARIFFS.AIR_PER_KG)} par kg.` : `${fcfa(TARIFFS.SEA_PER_CBM)} par m³.`} Minimum de facturation {fcfa(TARIFFS.MIN_CHARGE)}.</p>
        </div>
        <div className="flex flex-col justify-between rounded-3xl bg-deep p-7 text-white md:p-8">
          <div>
            <p className="text-sm text-white/70">Estimation</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl" aria-live="polite">{fcfa(price)}</p>
            <p className="mt-3 text-sm text-white/70">Délai indicatif : {mode === 'AIR' ? '7 à 10 jours' : '45 à 60 jours'} · Guangzhou → Lomé</p>
          </div>
          <a href={waLink(`Bonjour Kader Cargo, je souhaite expédier ${n} ${mode === 'AIR' ? 'kg en aérien' : 'm³ en maritime'} de Guangzhou vers Lomé.`)} target="_blank" rel="noopener noreferrer"
            className="mt-10 inline-flex h-12 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 font-semibold text-brand transition hover:bg-white/90">
            <WhatsAppIcon className="size-4" /> Réserver sur WhatsApp
          </a>
        </div>
      </div>
    </Section>
  )
}

function Contacts() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(site.guangzhou.addressZh)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable: the address stays selectable */ }
  }
  return (
    <Section id="contact" eyebrow="Agences & contacts" title="Présents aux deux bouts de la route." text="Appelez ou écrivez directement à nos équipes sur WhatsApp.">
      <div className="grid gap-5 lg:grid-cols-2">
        <AgencyCard code="CN" city={site.guangzhou.city} country={site.guangzhou.country} role={site.guangzhou.role} contacts={site.guangzhou.contacts}>
          <p className="flex gap-2.5 text-sm text-ink"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />{site.guangzhou.address}</p>
          <div className="mt-4 rounded-2xl border border-dashed border-brand/30 bg-brand-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">Adresse à donner à votre fournisseur</p>
            <p lang="zh-CN" className="mt-2 select-all text-base font-semibold leading-relaxed text-heading">{site.guangzhou.addressZh}</p>
            <button onClick={copy} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-heading shadow-sm transition hover:text-brand">
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} {copied ? 'Adresse copiée' : 'Copier l’adresse en chinois'}
            </button>
          </div>
        </AgencyCard>
        <AgencyCard code="TG" city={site.lome.city} country={site.lome.country} role={site.lome.role} contacts={site.lome.contacts}>
          <p className="flex gap-2.5 text-sm text-ink"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />{site.lome.address}</p>
        </AgencyCard>
      </div>
    </Section>
  )
}

function AgencyCard({ code, city, country, role, contacts, children }: { code: string; city: string; country: string; role: string; contacts: Contact[]; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-7 md:p-8">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">{role}</span>
        <span className="text-sm font-bold text-slate-300">{code}</span>
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-heading">{city}</h3>
      <p className="text-muted">{country}</p>
      <div className="mt-6">{children}</div>
      <ul className="mt-6 divide-y divide-line border-t border-line">
        {byPerson(contacts).map((p) => (
          <li key={p.name} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="font-semibold text-heading">{p.name}</p>
            <div className="flex flex-col gap-1.5 sm:items-end">
              {p.phones.map((ph) => (
                <div key={ph} className="flex items-center gap-1">
                  <a href={telLink(ph)} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium tabular-nums text-ink transition hover:bg-canvas hover:text-brand"><Phone className="size-3.5 text-slate-400" />{ph}</a>
                  <a href={waLink(`Bonjour ${p.name}, je vous contacte depuis le site Kader Cargo.`, ph)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${p.name} ${ph}`} title="WhatsApp"
                    className="grid size-8 place-items-center rounded-lg text-emerald-600 transition hover:bg-emerald-50"><WhatsAppIcon className="size-4" /></a>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Cta() {
  return (
    <section className="px-5 pb-20 pt-4 md:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-8 py-14 md:px-14 md:py-16">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Prêt à expédier&nbsp;?</h2>
            <p className="mt-3 max-w-md text-white/80">Envoyez-nous votre liste de colis sur WhatsApp : nous vous répondons avec un devis et l’adresse de l’entrepôt.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={waLink('Bonjour Kader Cargo, je souhaite un devis.')} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-brand transition hover:bg-white/90">
              <WhatsAppIcon className="size-4" /> {site.whatsappDisplay}
            </a>
            <Link to="/suivi" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/15 px-5 font-semibold text-white transition hover:bg-white/20">
              Suivre un colis <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
