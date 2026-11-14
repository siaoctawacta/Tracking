import { ImagePlus, MessageCircle, PackageX, Printer, RotateCw } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { BackLink } from '../../components/AppShell'
import { WhatsAppIcon } from '../../components/icons'
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
            <Notifications s={s} onDone={reload} />
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
      setMsg({ tone: 'success', text: 'Étape validée · alerte WhatsApp envoyée au client' })
      onDone()
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiError ? err.message : 'Erreur' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-heading">Mettre à jour le statut</h2>
      {allowed.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {s.status === 'DELIVERED' ? 'Colis remis au client — dossier clôturé.' : user?.role === 'AGENT_GZ' ? 'Le colis est sous la responsabilité de l’agence de Lomé.' : 'En attente de l’arrivée à Lomé.'}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-2">
            {allowed.map((st) => (
              <label key={st} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition', status === st ? 'border-brand bg-brand-50 font-semibold text-heading' : 'border-line hover:border-slate-300')}>
                <input type="radio" name="status" value={st} checked={status === st} onChange={() => setStatus(st)} className="accent-brand" />
                {stepLabel(st, s.mode)}
                {st === 'READY' && <span className="ml-auto text-xs font-normal text-muted">Valide le dédouanement</span>}
              </label>
            ))}
          </div>
          <Input name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour le client (facultatif)" maxLength={280} />
          {status && <AlertPreview shipmentId={s.id} status={status} note={note} />}
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" loading={busy} className="w-full" disabled={!status}>Valider & envoyer l’alerte WhatsApp</Button>
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
      <h2 className="flex items-center gap-2 font-semibold text-heading"><ImagePlus className="size-4" /> Ajouter des photos</h2>
      <PhotoPicker files={files} setFiles={setFiles} />
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {files.length > 0 && <Button onClick={upload} loading={busy} className="mt-3 w-full">Envoyer {files.length} photo{files.length > 1 ? 's' : ''}</Button>}
    </Card>
  )
}

/** Shows the exact WhatsApp message the client will receive for the selected step. */
function AlertPreview({ shipmentId, status, note }: { shipmentId: string; status: Status; note: string }) {
  const [body, setBody] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ status, ...(note.trim() && { note: note.trim() }) })
      api.get<{ body: string }>(`/shipments/${shipmentId}/alert-preview?${qs}`).then((r) => setBody(r.body)).catch(() => setBody(null))
    }, 250)
    return () => clearTimeout(t)
  }, [shipmentId, status, note])
  if (!body) return null
  return (
    <div className="rounded-2xl bg-[#e7ddd3] p-3 dark:bg-[#0b141a]">
      <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#54656f] dark:text-[#8696a0]"><WhatsAppIcon className="size-3.5" /> Aperçu du message</p>
      <div className="ml-auto max-w-[95%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        <WhatsAppText text={body} />
      </div>
    </div>
  )
}

/** Minimal WhatsApp formatting: *bold* and _italic_, line breaks preserved. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className="block min-h-[1em] whitespace-pre-wrap break-words">
          {line.split(/(\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <strong key={j}>{part.slice(1, -1)}</strong>
              : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={j} className="opacity-70">{part.slice(1, -1)}</em>
              : part,
          )}
        </span>
      ))}
    </>
  )
}

function Notifications({ s, onDone }: { s: Shipment; onDone: () => void }) {
  const list = s.notifications ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null)
  const tone = { SENT: 'text-emerald-600', SIMULATED: 'text-amber-600', FAILED: 'text-rose-600', PENDING: 'text-brand' }
  const label = { SENT: 'Envoyé', SIMULATED: 'Simulé', FAILED: 'Échec', PENDING: 'En cours d’envoi' }

  async function resend(id: string) {
    setBusy(id)
    try { await api.post(`/shipments/${s.id}/notifications/${id}/resend`); onDone() } finally { setBusy(null) }
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold text-heading"><MessageCircle className="size-4" /> Alertes WhatsApp</h2>
      <p className="mt-1 text-xs text-muted">Une alerte est envoyée au {s.clientPhone} à chaque étape franchie.</p>
      {list.length === 0 ? <p className="mt-3 text-sm text-muted">Aucune alerte envoyée.</p> : (
        <ul className="mt-4 space-y-2">
          {list.map((n) => (
            <li key={n.id} className="rounded-xl bg-canvas">
              <button onClick={() => setOpen(open === n.id ? null : n.id)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-xs">
                <span className="font-semibold text-heading">{n.step ? stepLabel(n.step, s.mode) : 'Alerte'}</span>
                <span className="flex items-center gap-2">
                  <span className={cx('font-semibold', tone[n.status])}>{label[n.status]}</span>
                  <span className="text-muted">{dateTime(n.sentAt ?? n.createdAt)}</span>
                </span>
              </button>
              {open === n.id && (
                <div className="border-t border-line px-3 pb-3 pt-2">
                  <p className="whitespace-pre-line text-xs leading-relaxed text-ink"><WhatsAppText text={n.body} /></p>
                  {n.error && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{n.error}</p>}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>{n.attempts} tentative{n.attempts > 1 ? 's' : ''} · {n.to}</span>
                    <Button size="sm" variant="ghost" loading={busy === n.id} onClick={() => resend(n.id)}><RotateCw className="size-3.5" /> Renvoyer</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
