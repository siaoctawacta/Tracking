import { ArrowRight, BadgeCheck, Camera, Clock3, FileText, MapPin, PackageSearch, Plane, Scale, Ship, Warehouse } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WhatsAppIcon } from '../components/icons'
import { TrackingSearch } from '../components/TrackingSearch'
import { cx } from '../components/ui'
import { fcfa } from '../lib/format'
import { site, waLink } from '../lib/site'

// Mirrors the API tariffs for the public estimator (the invoice amount is always computed server-side).
const TARIFFS = { SEA_PER_CBM: 250_000, AIR_PER_KG: 9_500, MIN_CHARGE: 10_000 }

export default function Home() {
  return (
    <>
      <Hero />
      <Facts />
      <Services />
      <Process />
      <Pricing />
      <Agencies />
      <Cta />
    </>
  )
}

function Section({ id, eyebrow, title, text, children, className }: { id?: string; eyebrow: string; title: string; text?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('scroll-mt-20 py-20 md:py-28', className)}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-electric">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy md:text-4xl">{title}</h2>
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
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(30,144,255,0.10),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-navy">
            <span className="size-1.5 rounded-full bg-electric" /> Chine → Togo · Maritime & Aérien
          </span>
          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-navy sm:text-5xl md:text-6xl">
            De Guangzhou à Lomé,{' '}
            <span className="text-electric">suivi à chaque étape.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Réception contrôlée en Chine, expédition par mer ou par air, dédouanement et retrait à Lomé. Vous savez toujours où se trouve votre colis.
          </p>
          <div className="mt-9 max-w-xl">
            <TrackingSearch />
            <p className="mt-3 pl-2 text-sm text-muted">
              Essayez&nbsp;: <Link to="/suivi/BC-2026-889X" className="font-semibold text-navy underline decoration-line underline-offset-4 hover:decoration-electric">BC-2026-889X</Link>
            </p>
          </div>
        </div>
        <RouteCard />
      </div>
    </section>
  )
}

function RouteCard() {
  return (
    <div className="animate-fade-up [animation-delay:120ms]">
      <div className="relative rounded-3xl border border-line bg-white p-6 pb-14 shadow-[0_30px_80px_-40px_rgba(18,30,49,0.35)] md:p-8 md:pb-16">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Colis</p>
            <p className="mt-1 font-bold tracking-wide text-navy">BC-2026-889X</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-electric-50 px-2.5 py-1 text-xs font-semibold text-electric-600">
            <span className="size-1.5 animate-pulse rounded-full bg-current" /> En mer
          </span>
        </div>

        <svg viewBox="0 0 320 120" className="mt-6 w-full" aria-hidden>
          <path id="route" d="M24 92 C 110 -6, 210 -6, 296 92" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 6" />
          <path d="M24 92 C 110 -6, 210 -6, 296 92" fill="none" stroke="#1E90FF" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="62 100" />
          <circle cx="24" cy="92" r="6" fill="#121E31" />
          <circle cx="296" cy="92" r="6" fill="#fff" stroke="#121E31" strokeWidth="2.5" />
          <g>
            <circle r="9" fill="#1E90FF" opacity="0.18">
              <animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;0.62;0.62" keyTimes="0;0.7;1" calcMode="linear"><mpath href="#route" /></animateMotion>
            </circle>
            <circle r="4.5" fill="#1E90FF">
              <animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;0.62;0.62" keyTimes="0;0.7;1" calcMode="linear"><mpath href="#route" /></animateMotion>
            </circle>
          </g>
        </svg>
        <div className="-mt-1 flex justify-between text-sm">
          <div>
            <p className="font-semibold text-navy">Guangzhou</p>
            <p className="text-xs text-muted">Chine · 11 oct.</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-navy">Lomé</p>
            <p className="text-xs text-muted">Togo · arrivée prévue</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
          {[['Mode', 'Maritime'], ['Poids', '64 kg'], ['Volume', '0,42 m³']].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
              <p className="mt-1 text-sm font-semibold text-navy">{v}</p>
            </div>
          ))}
        </div>

        <div className="absolute -bottom-5 left-6 right-6 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lg shadow-slate-900/5 md:left-auto md:right-8 md:w-72">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><WhatsAppIcon className="size-4" /></span>
          <p className="text-xs leading-snug text-ink"><span className="font-semibold">Alerte WhatsApp</span><br />Votre colis a quitté le port de Nansha.</p>
        </div>
      </div>
    </div>
  )
}

function Facts() {
  const facts = [
    { icon: <Ship className="size-4" />, v: '45 – 60 j', l: 'Délai maritime' },
    { icon: <Plane className="size-4" />, v: '7 – 10 j', l: 'Délai aérien' },
    { icon: <MapPin className="size-4" />, v: '2 agences', l: 'Guangzhou & Lomé' },
    { icon: <WhatsAppIcon className="size-4" />, v: 'Temps réel', l: 'Alertes WhatsApp' },
  ]
  return (
    <div className="border-y border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-5 md:grid-cols-4 md:divide-x">
        {facts.map((f) => (
          <div key={f.l} className="flex items-center gap-3 py-6 md:justify-center">
            <span className="grid size-9 place-items-center rounded-xl bg-electric-50 text-electric">{f.icon}</span>
            <div>
              <p className="font-bold text-navy">{f.v}</p>
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
    { icon: <BadgeCheck className="size-5" />, t: 'Dédouanement', d: 'Nous gérons les formalités au port et à l’aéroport de Lomé.' },
    { icon: <WhatsAppIcon className="size-5" />, t: 'Alertes WhatsApp', d: 'Un message à chaque changement de statut, sans rien installer.' },
    { icon: <FileText className="size-5" />, t: 'Factures en ligne', d: 'Factures et historique disponibles dans votre espace client.' },
  ]
  return (
    <Section id="services" eyebrow="Services" title="Deux façons d’expédier, une seule exigence." text="Choisissez la vitesse ou l’économie. Dans les deux cas, votre marchandise est contrôlée, consolidée et suivie jusqu’au retrait.">
      <div className="grid gap-5 md:grid-cols-2">
        <ServiceCard icon={<Ship className="size-6" />} title="Fret maritime" price={`${fcfa(TARIFFS.SEA_PER_CBM)} / m³`} delay="45 – 60 jours" points={['Groupage (LCL) dès 0,1 m³', 'Idéal pour volumes et marchandises lourdes', 'Arrivée au Port Autonome de Lomé']} />
        <ServiceCard dark icon={<Plane className="size-6" />} title="Fret aérien" price={`${fcfa(TARIFFS.AIR_PER_KG)} / kg`} delay="7 – 10 jours" points={['Départs chaque semaine', 'Électronique, échantillons, urgences', 'Arrivée à l’aéroport de Lomé']} />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {extras.map((e) => (
          <div key={e.t} className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
            <span className="grid size-10 place-items-center rounded-xl bg-canvas text-navy transition group-hover:bg-electric group-hover:text-white">{e.icon}</span>
            <p className="mt-5 font-semibold text-navy">{e.t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.d}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function ServiceCard({ icon, title, price, delay, points, dark }: { icon: ReactNode; title: string; price: string; delay: string; points: string[]; dark?: boolean }) {
  return (
    <div className={cx('rounded-3xl p-8 transition hover:-translate-y-0.5', dark ? 'bg-navy text-white' : 'border border-line bg-white')}>
      <div className="flex items-start justify-between">
        <span className={cx('grid size-12 place-items-center rounded-2xl', dark ? 'bg-white/10 text-electric' : 'bg-electric-50 text-electric')}>{icon}</span>
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', dark ? 'bg-white/10 text-white' : 'bg-canvas text-navy')}>
          <Clock3 className="size-3.5" /> {delay}
        </span>
      </div>
      <h3 className={cx('mt-8 text-2xl font-bold tracking-tight', dark ? 'text-white' : 'text-navy')}>{title}</h3>
      <p className={cx('mt-1 text-sm', dark ? 'text-slate-300' : 'text-muted')}>À partir de <span className={cx('font-semibold', dark ? 'text-white' : 'text-navy')}>{price}</span></p>
      <ul className="mt-6 space-y-2.5">
        {points.map((p) => (
          <li key={p} className={cx('flex items-center gap-2.5 text-sm', dark ? 'text-slate-200' : 'text-ink')}>
            <span className="size-1.5 rounded-full bg-electric" /> {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Process() {
  const steps = [
    { icon: <Warehouse className="size-5" />, t: 'Livrez à Guangzhou', d: 'Votre fournisseur dépose la marchandise à notre entrepôt avec votre nom et téléphone.' },
    { icon: <PackageSearch className="size-5" />, t: 'Contrôle & numéro de suivi', d: 'Pesée, mesure, photos. Vous recevez votre numéro BC-… par WhatsApp.' },
    { icon: <Ship className="size-5" />, t: 'Expédition', d: 'Votre colis est consolidé dans un conteneur ou un vol vers Lomé.' },
    { icon: <BadgeCheck className="size-5" />, t: 'Retrait à Lomé', d: 'Après dédouanement, récupérez votre colis à l’agence sur présentation du numéro.' },
  ]
  return (
    <Section id="process" eyebrow="Fonctionnement" title="Quatre étapes, zéro surprise." className="bg-white">
      <ol className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.t} className="bg-white p-7">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-navy text-white">{s.icon}</span>
              <span className="text-sm font-bold text-slate-300">0{i + 1}</span>
            </div>
            <p className="mt-6 font-semibold text-navy">{s.t}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Pricing() {
  const [mode, setMode] = useState<'SEA' | 'AIR'>('SEA')
  const [qty, setQty] = useState('1')
  const n = Math.max(0, Number(qty.replace(',', '.')) || 0)
  const raw = mode === 'AIR' ? n * TARIFFS.AIR_PER_KG : n * TARIFFS.SEA_PER_CBM
  const price = n > 0 ? Math.max(TARIFFS.MIN_CHARGE, Math.round(raw / 100) * 100) : 0

  return (
    <Section id="tarifs" eyebrow="Tarifs" title="Un prix clair, calculé en un instant." text="Le maritime est facturé au mètre cube, l’aérien au kilo. Pas de frais cachés : le montant de votre facture est celui affiché ici.">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-3xl border border-line bg-white p-7 md:p-8">
          <div className="inline-flex rounded-xl bg-canvas p-1">
            {(['SEA', 'AIR'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setQty(m === 'AIR' ? '10' : '1') }}
                className={cx('inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', mode === m ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy')}>
                {m === 'AIR' ? <Plane className="size-4" /> : <Ship className="size-4" />}
                {m === 'AIR' ? 'Aérien' : 'Maritime'}
              </button>
            ))}
          </div>
          <label className="mt-8 block">
            <span className="text-sm font-medium text-ink">{mode === 'AIR' ? 'Poids total (kg)' : 'Volume total (m³)'}</span>
            <div className="mt-2 flex items-center rounded-2xl border border-line bg-canvas px-4 focus-within:border-electric focus-within:bg-white focus-within:ring-4 focus-within:ring-electric/15">
              <Scale className="size-5 text-slate-400" />
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="h-14 w-full bg-transparent px-3 text-xl font-semibold text-navy focus:outline-none" aria-label="Quantité" />
              <span className="text-sm font-semibold text-muted">{mode === 'AIR' ? 'kg' : 'm³'}</span>
            </div>
          </label>
          <p className="mt-3 text-xs text-muted">{mode === 'AIR' ? `${fcfa(TARIFFS.AIR_PER_KG)} par kg.` : `${fcfa(TARIFFS.SEA_PER_CBM)} par m³.`} Minimum de facturation {fcfa(TARIFFS.MIN_CHARGE)}.</p>
        </div>
        <div className="flex flex-col justify-between rounded-3xl bg-navy p-7 text-white md:p-8">
          <div>
            <p className="text-sm text-slate-300">Estimation</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl" aria-live="polite">{fcfa(price)}</p>
            <p className="mt-3 text-sm text-slate-300">Délai indicatif : {mode === 'AIR' ? '7 à 10 jours' : '45 à 60 jours'} · Guangzhou → Lomé</p>
          </div>
          <a href={waLink(`Bonjour Benit Cargo, je souhaite expédier ${n} ${mode === 'AIR' ? 'kg en aérien' : 'm³ en maritime'} de Guangzhou vers Lomé.`)} target="_blank" rel="noopener noreferrer"
            className="mt-10 inline-flex h-12 items-center justify-center gap-2 self-start rounded-xl bg-electric px-5 font-semibold text-white transition hover:bg-electric-600">
            <WhatsAppIcon className="size-4" /> Réserver sur WhatsApp
          </a>
        </div>
      </div>
    </Section>
  )
}

function Agencies() {
  return (
    <Section id="agences" eyebrow="Agences" title="Présents aux deux bouts de la route." className="bg-white">
      <div className="grid gap-5 md:grid-cols-2">
        {site.agencies.map((a, i) => (
          <div key={a.city} className="rounded-3xl border border-line p-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-electric">{a.role}</span>
              <span className="text-sm font-bold text-slate-300">{i === 0 ? 'CN' : 'TG'}</span>
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-navy">{a.city}</h3>
            <p className="text-muted">{a.country}</p>
            <ul className="mt-6 space-y-2 text-sm text-ink">
              <li className="flex items-center gap-2.5"><MapPin className="size-4 text-slate-400" />{a.address}</li>
              <li className="flex items-center gap-2.5"><Clock3 className="size-4 text-slate-400" />{a.hours}</li>
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Cta() {
  return (
    <section className="px-5 pb-20 pt-4 md:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-navy px-8 py-14 md:px-14 md:py-16">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-electric/25 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Prêt à expédier&nbsp;?</h2>
            <p className="mt-3 max-w-md text-slate-300">Envoyez-nous votre liste de colis, nous vous répondons avec un devis et l’adresse de l’entrepôt.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={waLink('Bonjour Benit Cargo, je souhaite un devis.')} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-electric px-5 font-semibold text-white transition hover:bg-electric-600">
              <WhatsAppIcon className="size-4" /> Écrire sur WhatsApp
            </a>
            <Link to="/suivi" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 font-semibold text-white transition hover:bg-white/15">
              Suivre un colis <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
