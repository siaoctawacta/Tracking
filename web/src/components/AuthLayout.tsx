import { Hourglass, Lock, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo, WhatsAppIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'
import { site, waLink } from '../lib/site'

export function AuthLayout({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold tracking-tight text-heading">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 flex items-center gap-2 text-xs text-muted"><Lock className="size-3.5 shrink-0" /> Connexion chiffrée. Vos codes ne sont jamais demandés par nos agents.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-deep lg:block">
        <div aria-hidden className="absolute -left-24 top-1/3 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-end p-14">
          {aside ?? (
            <>
              <ShieldCheck className="size-10 text-white" />
              <p className="mt-6 max-w-md text-3xl font-bold leading-tight tracking-tight text-white">Vos colis Guangzhou → Lomé, au même endroit.</p>
              <p className="mt-4 max-w-sm text-white/70">Statuts en temps réel, alertes WhatsApp à chaque étape, factures et photos de vos marchandises prises à l’entrepôt.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Shown in demo mode only: the API returns the code because no WhatsApp/SMTP account is configured. */
export function DevCode({ code }: { code?: string }) {
  if (!code) return null
  return (
    <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700">
      <span className="font-semibold">Mode démo</span> — aucun envoi WhatsApp/e-mail réel n’est configuré. Code : <span className="font-mono text-sm font-bold tracking-widest">{code}</span>
    </div>
  )
}

export function PendingApproval({ channel }: { channel?: 'WHATSAPP' | 'EMAIL' | 'GOOGLE' }) {
  const how = channel === 'EMAIL' || channel === 'GOOGLE' ? 'par e-mail' : 'sur WhatsApp'
  return (
    <div className="animate-fade-up text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-brand"><Hourglass className="size-7" /></span>
      <h2 className="mt-5 text-xl font-bold text-heading">Compte en attente de validation</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Merci ! L’équipe Kader Cargo vérifie votre compte. Vous serez prévenu {how} dès son activation, généralement dans la journée.</p>
      <div className="mt-7 flex flex-col gap-2">
        <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600">Retour à l’accueil</Link>
        <a href={waLink('Bonjour Kader Cargo, je viens de créer mon compte.')} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-heading hover:bg-canvas">
          <WhatsAppIcon className="size-4 text-emerald-600" /> {site.whatsappDisplay}
        </a>
      </div>
    </div>
  )
}

export const channelLabel = (c: 'WHATSAPP' | 'EMAIL') => (c === 'WHATSAPP' ? 'par WhatsApp' : 'par e-mail')
