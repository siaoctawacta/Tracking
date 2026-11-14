import { CalendarClock, Container, Hash, Package, PackageX, Scale, User } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { WhatsAppIcon } from '../components/icons'
import { EventHistory, modeLabel, ModeIcon, StatusBadge, StatusStepper } from '../components/status'
import { TrackingSearch } from '../components/TrackingSearch'
import { Card, Empty, PageLoader } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { dateLong, num } from '../lib/format'
import { waLink } from '../lib/site'
import type { PublicTracking } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function Track() {
  const { trackingId } = useParams()

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-heading md:text-4xl">Suivi de colis</h1>
        <p className="mt-3 text-muted">Saisissez le numéro reçu par WhatsApp lors de la réception à Guangzhou.</p>
        <div className="mt-8">
          <TrackingSearch key={trackingId} initial={trackingId ?? ''} size="md" autoFocus={!trackingId} />
        </div>
      </div>
      {trackingId && <Result trackingId={trackingId} />}
    </div>
  )
}

function Result({ trackingId }: { trackingId: string }) {
  const { data, error, loading } = useAsync(() => api.get<{ tracking: PublicTracking }>(`/tracking/${encodeURIComponent(trackingId)}`), [trackingId])

  if (loading) return <PageLoader />
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <Card className="mt-12">
        <Empty
          icon={<PackageX className="size-5" />}
          title={notFound ? 'Aucun colis trouvé' : 'Recherche impossible'}
          text={notFound ? `Vérifiez le numéro ${trackingId}. Un colis apparaît ici dès sa réception à notre entrepôt de Guangzhou.` : error.message}
          action={
            <a href={waLink(`Bonjour, je ne trouve pas mon colis ${trackingId}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-heading hover:bg-slate-50">
              <WhatsAppIcon className="size-4 text-emerald-600" /> Contacter le support
            </a>
          }
        />
      </Card>
    )
  }
  const t = data!.tracking
  const eta = t.container?.etaAt

  return (
    <div className="mt-12 animate-fade-up space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 border-b border-line p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-bold tracking-wide text-heading">{t.trackingId}</p>
              <StatusBadge status={t.status} label={t.statusLabel} />
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <ModeIcon mode={t.mode} /> {modeLabel(t.mode)} · {t.origin} → {t.destination}
            </p>
          </div>
          {eta && t.status !== 'DELIVERED' && t.status !== 'READY' && (
            <div className="rounded-2xl bg-canvas px-5 py-3 md:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Arrivée estimée</p>
              <p className="mt-0.5 text-lg font-bold text-heading">{dateLong(eta)}</p>
            </div>
          )}
        </div>
        <div className="p-6 md:p-10">
          <StatusStepper status={t.status} mode={t.mode} events={t.events} />
        </div>
      </Card>

      <div className="grid items-start gap-5 md:grid-cols-[1fr_1.3fr]">
        <Card className="p-6 md:p-7">
          <h2 className="font-semibold text-heading">Détails</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Row icon={<Package className="size-4" />} k="Contenu" v={t.description} />
            <Row icon={<Hash className="size-4" />} k="Colis" v={`${t.pieces} pièce${t.pieces > 1 ? 's' : ''}`} />
            <Row icon={<Scale className="size-4" />} k="Poids / Volume" v={`${num(t.weightKg)} kg · ${num(t.volumeCbm, 3)} m³`} />
            <Row icon={<User className="size-4" />} k="Destinataire" v={`${t.recipient} · ${t.recipientPhone}`} />
            {t.container && <Row icon={<Container className="size-4" />} k="Lot" v={t.container.code} />}
            <Row icon={<CalendarClock className="size-4" />} k="Réceptionné le" v={dateLong(t.createdAt)} />
          </dl>
          <a
            href={waLink(`Bonjour Kader Cargo, j’ai une question sur mon colis ${t.trackingId}.`)}
            target="_blank" rel="noopener noreferrer"
            className="mt-7 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            <WhatsAppIcon className="size-4" /> Une question ? Écrivez-nous
          </a>
          <p className="mt-3 text-center text-xs text-muted">Une alerte WhatsApp est envoyée automatiquement au destinataire à chaque étape.</p>
        </Card>
        <Card className="self-start p-6 md:p-7">
          <h2 className="font-semibold text-heading">Historique</h2>
          <div className="mt-6"><EventHistory events={t.events} /></div>
        </Card>
      </div>
    </div>
  )
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{k}</dt>
        <dd className="font-medium text-ink">{v}</dd>
      </div>
    </div>
  )
}
