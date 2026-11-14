import { Lock, PackageX, ScanLine, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink, PageHeader } from '../../components/AppShell'
import { ModeIcon, StatusBadge } from '../../components/status'
import { Alert, Button, Card, Empty, Input, PageLoader, Stat, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateLong, normalizeTracking, num, ROLE_STATUSES, STATUSES, stepLabel } from '../../lib/format'
import type { Container, Status } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function ContainerDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => api.get<{ container: Container }>(`/containers/${id}`), [id])
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <PageLoader />
  if (error || !data) return <Card><Empty icon={<PackageX className="size-5" />} title="Conteneur introuvable" /></Card>
  const c = data.container
  const shipments = c.shipments ?? []
  const isGz = user?.role === 'AGENT_GZ' || user?.role === 'ADMIN'
  const weight = shipments.reduce((a, s) => a + s.weightKg, 0)
  const volume = shipments.reduce((a, s) => a + s.volumeCbm, 0)

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    setMsg(null)
    try { setMsg({ tone: 'success', text: await fn() }); reload() } catch (e) { setMsg({ tone: 'error', text: e instanceof ApiError ? e.message : 'Erreur' }) } finally { setBusy(false) }
  }

  const close = () => {
    if (!confirm(`Clôturer ${c.code} ? Les ${shipments.length} colis passeront « En cours de chargement ».`)) return
    run(async () => { await api.post(`/containers/${c.id}/close`); return 'Lot clôturé · clients notifiés' })
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/admin/conteneurs" label="Conteneurs" />}
        title={<span className="flex items-center gap-3">{c.code}<span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', c.state === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>{c.state === 'OPEN' ? 'Ouvert' : 'Clôturé'}</span></span>}
        text={<span className="inline-flex items-center gap-2"><ModeIcon mode={c.mode} /> {c.mode === 'AIR' ? 'Fret aérien' : 'Fret maritime'} · Guangzhou → Lomé</span>}
        actions={isGz && c.state === 'OPEN' && <Button variant="dark" onClick={close} loading={busy} disabled={!shipments.length}><Lock className="size-4" /> Clôturer le lot</Button>}
      />
      {msg && <div className="mb-5"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Colis" value={shipments.length} />
        <Stat label="Poids" value={`${num(weight, 1)} kg`} />
        <Stat label="Volume" value={`${num(volume, 2)} m³`} sub={c.mode === 'SEA' ? `${Math.round((volume / 33) * 100)} % d’un 20' (33 m³)` : undefined} />
        <Stat label="Arrivée estimée" value={<span className="text-lg">{dateLong(c.etaAt)}</span>} sub={c.departureAt ? `Départ ${dateLong(c.departureAt)}` : 'Départ non programmé'} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-navy">Colis du lot</h2></div>
          {shipments.length === 0 ? <Empty icon={<ScanLine className="size-5" />} title="Lot vide" text="Scannez ou saisissez des numéros de suivi pour les ajouter." /> : (
            <ul className="divide-y divide-line">
              {shipments.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link to={`/admin/colis/${s.id}`} className="min-w-0 hover:opacity-80">
                    <p className="font-semibold tracking-wide text-navy">{s.trackingId}</p>
                    <p className="truncate text-xs text-muted">{s.clientName} · {num(s.weightKg)} kg · {num(s.volumeCbm, 3)} m³</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} label={s.statusLabel} />
                    {isGz && c.state === 'OPEN' && (
                      <button onClick={() => run(async () => { await api.del(`/containers/${c.id}/shipments/${s.id}`); return `${s.trackingId} retiré du lot` })} className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Retirer"><X className="size-4" /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-5">
          {isGz && c.state === 'OPEN' && <AddShipments id={c.id} onDone={(t) => { setMsg(t); reload() }} />}
          {c.state === 'CLOSED' && <BulkStatus key={shipments.map((s) => s.status).join()} c={c} onRun={run} busy={busy} />}
        </div>
      </div>
    </>
  )
}

function AddShipments({ id, onDone }: { id: string; onDone: (m: { tone: 'success' | 'error' | 'info'; text: string }) => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const ids = value.split(/[\s,;]+/).map(normalizeTracking).filter(Boolean)
    if (!ids.length) return
    setBusy(true)
    try {
      const r = await api.post<{ assigned: number; rejected: { trackingId: string; reason: string }[] }>(`/containers/${id}/shipments`, { trackingIds: ids })
      setValue('')
      onDone({
        tone: r.rejected.length ? 'info' : 'success',
        text: `${r.assigned} colis ajouté${r.assigned > 1 ? 's' : ''}` + (r.rejected.length ? ` · refusés : ${r.rejected.map((x) => `${x.trackingId} (${x.reason})`).join(', ')}` : ''),
      })
    } catch (e) {
      onDone({ tone: 'error', text: e instanceof ApiError ? e.message : 'Erreur' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold text-navy"><ScanLine className="size-4" /> Ajouter des colis</h2>
      <p className="mt-1 text-xs text-muted">Scannez l’étiquette (douchette) ou collez plusieurs numéros.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Input name="trackingIds" value={value} onChange={(e) => setValue(e.target.value)} placeholder="BC-2026-…" autoFocus autoComplete="off" />
        <Button type="submit" loading={busy} className="w-full" disabled={!value.trim()}>Ajouter au lot</Button>
      </form>
    </Card>
  )
}

function BulkStatus({ c, onRun, busy }: { c: Container; onRun: (fn: () => Promise<string>) => void; busy: boolean }) {
  const { user } = useAuth()
  const min = Math.min(...(c.shipments ?? []).map((s) => STATUSES.indexOf(s.status)))
  const options = ROLE_STATUSES[user!.role].filter((s) => STATUSES.indexOf(s) > min)
  const [status, setStatus] = useState<Status | ''>(options[0] ?? '')
  const [note, setNote] = useState('')
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-navy">Mise à jour en masse</h2>
      <p className="mt-1 text-xs text-muted">Chaque client reçoit une alerte WhatsApp.</p>
      {options.length === 0 ? <p className="mt-4 text-sm text-muted">Aucune étape disponible pour votre rôle.</p> : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2">
            {options.map((s) => (
              <label key={s} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm', status === s ? 'border-electric bg-electric-50 font-semibold text-navy' : 'border-line')}>
                <input type="radio" checked={status === s} onChange={() => setStatus(s)} className="accent-electric" /> {stepLabel(s, c.mode)}
              </label>
            ))}
          </div>
          <Input name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex : Navire MSC Aurora, départ Nansha)" />
          <Button className="w-full" loading={busy} disabled={!status} onClick={() => onRun(async () => {
            const r = await api.patch<{ updated: number }>(`/containers/${c.id}/status`, { status, ...(note && { note }) })
            setNote('')
            return `${r.updated} colis mis à jour · alertes envoyées`
          })}>Appliquer à tout le lot</Button>
        </div>
      )}
    </Card>
  )
}
