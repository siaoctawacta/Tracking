import { ImagePlus, MessageCircle, PackageX, Printer } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { BackLink } from '../../components/AppShell'
import { ShipmentView } from '../../components/ShipmentView'
import { Alert, Button, Card, Empty, Input, PageLoader, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateTime, ROLE_STATUSES, STATUSES, stepLabel } from '../../lib/format'
import type { Shipment, Status } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { PhotoPicker } from './NewShipment'

export default function ShipmentAdmin() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => api.get<{ shipment: Shipment }>(`/shipments/${id}`), [id])

  if (loading && !data) return <PageLoader />
  if (error || !data) return <Card><Empty icon={<PackageX className="size-5" />} title="Colis introuvable" text={error?.message} /></Card>
  const s = data.shipment
  const canPhoto = user?.role === 'AGENT_GZ' || user?.role === 'ADMIN'

  return (
    <>
      <BackLink to="/admin/colis" label="Colis" />
      <ShipmentView
        s={s}
        staff
        actions={<Button variant="outline" size="sm" onClick={() => api.open(`/shipments/${s.id}/label.pdf`)}><Printer className="size-4" /> Étiquette</Button>}
        aside={
          <>
            <StatusPanel s={s} onDone={reload} />
            {canPhoto && <PhotoUpload id={s.id} onDone={reload} />}
            <Notifications s={s} />
          </>
        }
      />
    </>
  )
}

function StatusPanel({ s, onDone }: { s: Shipment; onDone: () => void }) {
  const { user } = useAuth()
  const current = STATUSES.indexOf(s.status)
  const allowed = ROLE_STATUSES[user!.role].filter((st) => user!.role === 'ADMIN' ? st !== s.status : STATUSES.indexOf(st) > current)
  const [status, setStatus] = useState<Status | ''>(allowed[0] ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  // After a successful update the parcel moves on: preselect the next allowed step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setStatus(allowed[0] ?? ''), [s.status])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!status) return
    setBusy(true)
    setMsg(null)
    try {
      await api.patch(`/shipments/${s.id}/status`, { status, ...(note && { note }) })
      setNote('')
      setMsg({ tone: 'success', text: 'Statut mis à jour · alerte WhatsApp envoyée' })
      onDone()
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'Erreur' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-navy">Mettre à jour le statut</h2>
      {allowed.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {s.status === 'DELIVERED' ? 'Colis remis au client — dossier clôturé.' : user?.role === 'AGENT_GZ' ? 'Le colis est sous la responsabilité de l’agence de Lomé.' : 'En attente de l’arrivée à Lomé.'}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-2">
            {allowed.map((st) => (
              <label key={st} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition', status === st ? 'border-electric bg-electric-50 font-semibold text-navy' : 'border-line hover:border-slate-300')}>
                <input type="radio" name="status" value={st} checked={status === st} onChange={() => setStatus(st)} className="accent-electric" />
                {stepLabel(st, s.mode)}
                {st === 'READY' && <span className="ml-auto text-xs font-normal text-muted">Valide le dédouanement</span>}
              </label>
            ))}
          </div>
          <Input name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour le client (facultatif)" maxLength={280} />
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" loading={busy} className="w-full" disabled={!status}>Valider</Button>
        </form>
      )}
    </Card>
  )
}

function PhotoUpload({ id, onDone }: { id: string; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function upload() {
    setBusy(true)
    setErr('')
    const fd = new FormData()
    files.forEach((f) => fd.append('photos', f))
    try {
      await api.post(`/shipments/${id}/photos`, fd)
      setFiles([])
      onDone()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold text-navy"><ImagePlus className="size-4" /> Ajouter des photos</h2>
      <PhotoPicker files={files} setFiles={setFiles} />
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {files.length > 0 && <Button onClick={upload} loading={busy} className="mt-3 w-full">Envoyer {files.length} photo{files.length > 1 ? 's' : ''}</Button>}
    </Card>
  )
}

function Notifications({ s }: { s: Shipment }) {
  const list = s.notifications ?? []
  const tone = { SENT: 'text-emerald-600', SIMULATED: 'text-amber-600', FAILED: 'text-rose-600' }
  const label = { SENT: 'Envoyé', SIMULATED: 'Simulé', FAILED: 'Échec' }
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold text-navy"><MessageCircle className="size-4" /> Alertes WhatsApp</h2>
      {list.length === 0 ? <p className="mt-3 text-sm text-muted">Aucune alerte envoyée.</p> : (
        <ul className="mt-4 space-y-3">
          {list.map((n) => (
            <li key={n.id} className="rounded-xl bg-canvas p-3">
              <div className="flex justify-between text-xs">
                <span className={cx('font-semibold', tone[n.status])}>{label[n.status]} · {n.to}</span>
                <span className="text-muted">{dateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ink">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
