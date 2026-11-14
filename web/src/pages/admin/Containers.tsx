import { Container as Box, Plane, Plus, Ship } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/AppShell'
import { StatusBadge } from '../../components/status'
import { Alert, Button, Card, Empty, Input, PageLoader, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateShort, num } from '../../lib/format'
import type { Container, Mode } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function Containers() {
  const { user } = useAuth()
  const { data, loading } = useAsync(() => api.get<{ containers: Container[] }>('/containers'), [])
  const [creating, setCreating] = useState(false)
  const canCreate = user?.role === 'AGENT_GZ' || user?.role === 'ADMIN'

  return (
    <>
      <PageHeader
        title="Conteneurs & lots"
        text="Consolidez les colis, clôturez le lot puis mettez à jour tous les statuts en une fois."
        actions={canCreate && <Button onClick={() => setCreating((c) => !c)}><Plus className="size-4" /> Nouveau lot</Button>}
      />
      {creating && <CreateForm onCancel={() => setCreating(false)} />}
      {loading ? <PageLoader /> : !data?.containers.length ? (
        <Card><Empty icon={<Box className="size-5" />} title="Aucun conteneur" text="Créez un premier lot maritime ou aérien." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.containers.map((c) => (
            <Link key={c.id} to={`/admin/conteneurs/${c.id}`} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
              <div className="flex items-start justify-between">
                <span className={cx('grid size-10 place-items-center rounded-xl', c.mode === 'AIR' ? 'bg-navy text-white' : 'bg-electric-50 text-electric')}>{c.mode === 'AIR' ? <Plane className="size-5" /> : <Ship className="size-5" />}</span>
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', c.state === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>{c.state === 'OPEN' ? 'Ouvert' : 'Clôturé'}</span>
              </div>
              <p className="mt-5 font-bold tracking-wide text-navy">{c.code}</p>
              <p className="text-xs text-muted">{c.count} colis · {num(c.weightKg ?? 0, 0)} kg · {num(c.volumeCbm ?? 0, 2)} m³</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
                <span>ETA {dateShort(c.etaAt)}</span>
                {c.status && <StatusBadge status={c.status} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

function CreateForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('SEA')
  const [etaAt, setEta] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.post<{ container: Container }>('/containers', { mode, ...(etaAt && { etaAt }) })
      navigate(`/admin/conteneurs/${r.container.id}`)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erreur')
      setBusy(false)
    }
  }
  return (
    <Card className="mb-6 animate-fade-up p-6">
      <form onSubmit={submit} className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 md:w-64">
          {(['SEA', 'AIR'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cx('h-9 cursor-pointer rounded-lg text-sm font-semibold', mode === m ? 'bg-white text-navy shadow-sm' : 'text-muted')}>{m === 'AIR' ? 'Aérien' : 'Maritime'}</button>
          ))}
        </div>
        <div className="md:w-56"><Input label="Arrivée estimée" type="date" name="etaAt" value={etaAt} onChange={(e) => setEta(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>Créer le lot</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
    </Card>
  )
}
