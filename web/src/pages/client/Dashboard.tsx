import { ArrowUpRight, Boxes, PackageCheck, Truck, UserCog } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClientShell, PageHeader } from '../../components/AppShell'
import { ModeIcon, StatusBadge } from '../../components/status'
import { TrackingSearch } from '../../components/TrackingSearch'
import { Card, Empty, PageLoader, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateShort, fcfa, STATUSES } from '../../lib/format'
import type { Shipment } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function ClientDashboard() {
  const { user } = useAuth()
  const { data, loading } = useAsync(() => api.get<{ shipments: Shipment[] }>('/shipments/mine'), [])
  const list = data?.shipments ?? []
  const active = list.filter((s) => !['READY', 'DELIVERED'].includes(s.status)).length
  const ready = list.filter((s) => s.status === 'READY').length

  return (
    <ClientShell>
      <PageHeader
        title={`Bonjour ${user?.name.split(' ')[0]} 👋`}
        text="Vos expéditions associées à votre numéro et à votre e-mail."
        actions={<Link to="/espace/compte" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-heading hover:bg-canvas sm:hidden"><UserCog className="size-4" /> Mon compte</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Pill icon={<Truck className="size-4" />} label="En cours" value={active} />
        <Pill icon={<PackageCheck className="size-4" />} label="À retirer à Lomé" value={ready} highlight={ready > 0} />
        <Pill icon={<Boxes className="size-4" />} label="Total" value={list.length} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-semibold text-heading">Mes colis</h2>
      </div>

      {loading ? <PageLoader /> : list.length === 0 ? (
        <Card className="mt-4">
          <Empty icon={<Boxes className="size-5" />} title="Aucun colis pour le moment" text="Vos colis apparaîtront ici dès leur réception à l’entrepôt de Guangzhou." action={<div className="w-80 max-w-full"><TrackingSearch size="md" /></div>} />
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((s, i) => (
            <li key={s.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <Link to={`/espace/colis/${s.id}`} className="group block rounded-2xl border border-line bg-surface p-5 transition hover:border-slate-300 hover:shadow-lg hover:shadow-black/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-heading"><ModeIcon mode={s.mode} className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold tracking-wide text-heading">{s.trackingId}</p>
                      <p className="truncate text-sm text-muted">{s.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} label={s.statusLabel} className="hidden sm:inline-flex" />
                    <ArrowUpRight className="size-4 text-slate-300 transition group-hover:text-brand" />
                  </div>
                </div>
                <Progress status={s.status} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <StatusBadge status={s.status} label={s.statusLabel} className="sm:hidden" />
                  <span>Reçu le {dateShort(s.createdAt)}{s.container?.etaAt && !['READY', 'DELIVERED'].includes(s.status) ? ` · Arrivée prévue ${dateShort(s.container.etaAt)}` : ''}</span>
                  <span className="font-semibold text-heading">{fcfa(s.priceXof)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ClientShell>
  )
}

function Progress({ status }: { status: Shipment['status'] }) {
  const i = STATUSES.indexOf(status)
  return (
    <div className="mt-5 flex gap-1">
      {STATUSES.map((s, j) => <span key={s} className={cx('h-1 flex-1 rounded-full', j <= i ? 'bg-brand' : 'bg-line')} />)}
    </div>
  )
}

function Pill({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cx('flex items-center gap-4 rounded-2xl border p-5', highlight ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-surface')}>
      <span className={cx('grid size-10 place-items-center rounded-xl', highlight ? 'bg-emerald-500 text-white' : 'bg-brand-50 text-brand')}>{icon}</span>
      <div>
        <p className="text-2xl font-bold text-heading">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}
