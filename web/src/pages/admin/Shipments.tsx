import { ChevronLeft, ChevronRight, PackageSearch, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/AppShell'
import { ModeIcon, StatusBadge } from '../../components/status'
import { Card, Empty, PageLoader, Select, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateShort, fcfa, num, STATUSES, STATUS_SHORT } from '../../lib/format'
import type { Shipment } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function Shipments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const mode = params.get('mode') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [q, setQ] = useState(params.get('q') ?? '')

  // Debounced search → URL (keeps filters shareable / back-button friendly).
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return
    const t = setTimeout(() => update({ q: q || null, page: null }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k)
    setParams(p, { replace: true })
  }

  const qs = new URLSearchParams({ page: String(page), ...(status && { status }), ...(mode && { mode }), ...(params.get('q') && { q: params.get('q')! }) })
  const { data, loading } = useAsync(() => api.get<{ shipments: Shipment[]; total: number; pageSize: number }>(`/shipments?${qs}`), [qs.toString()])
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const canCreate = user?.role === 'AGENT_GZ' || user?.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Colis"
        text={data ? `${data.total} expédition${data.total > 1 ? 's' : ''}` : ' '}
        actions={canCreate && <Link to="/admin/colis/nouveau" className="inline-flex h-11 items-center gap-2 rounded-xl bg-electric px-5 text-sm font-semibold text-white hover:bg-electric-600"><Plus className="size-4" /> Nouvelle réception</Link>}
      />

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de suivi, client, téléphone, contenu…" className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15" />
        </label>
        <Select value={mode} onChange={(e) => update({ mode: e.target.value || null, page: null })} className="md:w-44" aria-label="Mode">
          <option value="">Tous les modes</option>
          <option value="SEA">Maritime</option>
          <option value="AIR">Aérien</option>
        </Select>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} onClick={() => update({ status: s || null, page: null })}
            className={cx('shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition', status === s ? 'border-navy bg-navy text-white' : 'border-line bg-white text-muted hover:text-navy')}>
            {s ? STATUS_SHORT[s as keyof typeof STATUS_SHORT] : 'Tous'}
          </button>
        ))}
      </div>

      <Card className="mt-5 overflow-hidden">
        {loading && !data ? <PageLoader /> : !data?.shipments.length ? (
          <Empty icon={<PackageSearch className="size-5" />} title="Aucun colis" text="Aucune expédition ne correspond à ces filtres." />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Colis</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Poids / Vol.</th>
                  <th className="px-5 py-3 font-medium">Lot</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className={cx('divide-y divide-line transition-opacity', loading && 'opacity-50')}>
                {data.shipments.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/admin/colis/${s.id}`)} className="cursor-pointer transition hover:bg-canvas/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-lg bg-canvas text-navy"><ModeIcon mode={s.mode} /></span>
                        <div>
                          <p className="font-semibold tracking-wide text-navy">{s.trackingId}</p>
                          <p className="max-w-[220px] truncate text-xs text-muted">{s.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><p className="font-medium">{s.clientName}</p><p className="text-xs text-muted">{s.clientPhone}</p></td>
                    <td className="px-5 py-3.5 text-muted">{num(s.weightKg)} kg<br />{num(s.volumeCbm, 3)} m³</td>
                    <td className="px-5 py-3.5 text-muted">{s.container?.code ?? '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.status} label={s.statusLabel} /><p className="mt-1 text-xs text-muted">{dateShort(s.updatedAt)}</p></td>
                    <td className="px-5 py-3.5 text-right font-semibold text-navy">{fcfa(s.priceXof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {data.shipments.map((s) => (
                <li key={s.id}>
                  <Link to={`/admin/colis/${s.id}`} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold tracking-wide text-navy"><ModeIcon mode={s.mode} className="size-3.5" />{s.trackingId}</p>
                      <p className="truncate text-xs text-muted">{s.clientName} · {s.description}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="mr-2 text-muted">Page {page} / {pages}</span>
          <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-white disabled:opacity-40" aria-label="Page précédente"><ChevronLeft className="size-4" /></button>
          <button disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-white disabled:opacity-40" aria-label="Page suivante"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </>
  )
}
