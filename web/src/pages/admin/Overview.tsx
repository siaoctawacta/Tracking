import { ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/AppShell'
import { StatusBadge } from '../../components/status'
import { Card, PageLoader, Stat } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fcfa, num, relative, ROLE_LABELS, STATUSES, STATUS_SHORT } from '../../lib/format'
import type { Status } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

interface Stats {
  byStatus: Record<Status, number>
  byMode: { mode: 'SEA' | 'AIR'; count: number; revenueXof: number; weightKg: number; volumeCbm: number }[]
  openContainers: number
  recent: { id: string; status: Status; label: string; at: string; shipment: { id: string; trackingId: string } }[]
}

export default function Overview() {
  const { user } = useAuth()
  const { data, loading } = useAsync(() => api.get<Stats>('/shipments/stats'), [])
  if (loading || !data) return <PageLoader />

  const total = STATUSES.reduce((a, s) => a + data.byStatus[s], 0)
  const inFlight = data.byStatus.REGISTERED + data.byStatus.LOADING + data.byStatus.IN_TRANSIT + data.byStatus.ARRIVED
  const revenue = data.byMode.reduce((a, m) => a + m.revenueXof, 0)
  const sea = data.byMode.find((m) => m.mode === 'SEA')
  const air = data.byMode.find((m) => m.mode === 'AIR')
  const canCreate = user?.role === 'AGENT_GZ' || user?.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Vue d’ensemble"
        text={`${ROLE_LABELS[user!.role]} · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={canCreate && <Link to="/admin/colis/nouveau" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm shadow-brand/25 hover:bg-brand-600"><Plus className="size-4" /> Nouvelle réception</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Colis en cours" value={inFlight} sub={`${total} au total`} />
        <Stat label="À retirer à Lomé" value={data.byStatus.READY} sub="Dédouanés" />
        <Stat label="Lots ouverts" value={data.openContainers} sub="En préparation à Guangzhou" />
        <Stat label="Chiffre d’affaires" value={<span className="text-xl md:text-2xl">{fcfa(revenue)}</span>} sub={`${sea?.count ?? 0} maritime · ${air?.count ?? 0} aérien`} />
      </div>

      <Card className="mt-5 p-6">
        <h2 className="font-semibold text-heading">Pipeline</h2>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-line">
          {STATUSES.map((s, i) => data.byStatus[s] > 0 && (
            <div key={s} title={`${STATUS_SHORT[s]} : ${data.byStatus[s]}`} style={{ width: `${(data.byStatus[s] / total) * 100}%`, opacity: 0.35 + (i / STATUSES.length) * 0.65 }} className="bg-brand first:rounded-l-full last:rounded-r-full" />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => (
            <Link key={s} to={`/admin/colis?status=${s}`} className="rounded-xl border border-line p-3 transition hover:border-brand/40 hover:bg-brand-50/40">
              <p className="text-xl font-bold text-heading">{data.byStatus[s]}</p>
              <p className="text-xs text-muted">{STATUS_SHORT[s]}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-heading">Activité récente</h2>
            <Link to="/admin/colis" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Tous les colis <ArrowRight className="size-3.5" /></Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {data.recent.map((e) => (
              <li key={e.id}>
                <Link to={`/admin/colis/${e.shipment.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-wide text-heading">{e.shipment.trackingId}</p>
                    <p className="text-xs text-muted">{relative(e.at)}</p>
                  </div>
                  <StatusBadge status={e.status} label={e.label} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold text-heading">Volumes expédiés</h2>
          <div className="mt-5 space-y-5">
            <Volume label="Maritime" value={`${num(sea?.volumeCbm ?? 0, 2)} m³`} sub={`${num(sea?.weightKg ?? 0, 0)} kg · ${fcfa(sea?.revenueXof ?? 0)}`} />
            <Volume label="Aérien" value={`${num(air?.weightKg ?? 0, 1)} kg`} sub={`${air?.count ?? 0} colis · ${fcfa(air?.revenueXof ?? 0)}`} />
          </div>
        </Card>
      </div>
    </>
  )
}

function Volume({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-canvas p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-heading">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  )
}
