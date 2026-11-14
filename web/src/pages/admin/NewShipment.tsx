import { Check, ImagePlus, Plane, Printer, Ship, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BackLink, PageHeader } from '../../components/AppShell'
import { Alert, Button, Card, Input, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { fcfa } from '../../lib/format'
import type { Mode, Shipment } from '../../lib/types'

const TARIFFS = { SEA_PER_CBM: 250_000, AIR_PER_KG: 9_500, MIN_CHARGE: 10_000 }
const empty = { description: '', pieces: '1', weightKg: '', volumeCbm: '', clientName: '', clientPhone: '', clientEmail: '' }

export default function NewShipment() {
  const [mode, setMode] = useState<Mode>('SEA')
  const [form, setForm] = useState(empty)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Shipment | null>(null)

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const n = (v: string) => Number(v.replace(',', '.')) || 0
  const estimate = Math.max(TARIFFS.MIN_CHARGE, Math.round((mode === 'AIR' ? n(form.weightKg) * TARIFFS.AIR_PER_KG : n(form.volumeCbm) * TARIFFS.SEA_PER_CBM) / 100) * 100)
  const fieldError = (p: string) => error?.fields?.find((f) => f.path === p)?.message

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('mode', mode)
    for (const [k, v] of Object.entries(form)) fd.set(k, k === 'weightKg' || k === 'volumeCbm' ? String(n(v)) : v)
    files.forEach((f) => fd.append('photos', f))
    try {
      const r = await api.post<{ shipment: Shipment }>('/shipments', fd)
      setCreated(r.shipment)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'network', 'Erreur réseau'))
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg animate-fade-up py-10 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-7" strokeWidth={3} /></span>
        <h1 className="mt-6 text-2xl font-bold text-heading">Colis enregistré</h1>
        <p className="mt-2 text-muted">Le client a été notifié sur WhatsApp ({created.clientPhone}).</p>
        <p className="mt-8 rounded-2xl border border-dashed border-brand/40 bg-brand-50 py-5 text-3xl font-extrabold tracking-wider text-heading">{created.trackingId}</p>
        <p className="mt-3 text-sm text-muted">Montant : <span className="font-semibold text-heading">{fcfa(created.priceXof)}</span></p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="dark" onClick={() => api.open(`/shipments/${created.id}/label.pdf`)}><Printer className="size-4" /> Imprimer l’étiquette</Button>
          <Link to={`/admin/colis/${created.id}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-slate-50">Voir le colis</Link>
          <Button variant="ghost" onClick={() => { setCreated(null); setForm(empty); setFiles([]) }}>Nouvelle réception</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader back={<BackLink to="/admin/colis" label="Colis" />} title="Nouvelle réception" text="Entrepôt Guangzhou — pesée, mesure et photos de contrôle." />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {error && !error.fields && <Alert>{error.message}</Alert>}
          <Card className="p-6">
            <h2 className="font-semibold text-heading">Marchandise</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1">
              {(['SEA', 'AIR'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cx('flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition', mode === m ? 'bg-surface text-heading shadow-sm' : 'text-muted hover:text-heading')}>
                  {m === 'AIR' ? <Plane className="size-4" /> : <Ship className="size-4" />}{m === 'AIR' ? 'Aérien' : 'Maritime'}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Input label="Description du contenu" name="description" value={form.description} onChange={set('description')} placeholder="ex : Pièces détachées moto (2 cartons)" error={fieldError('description')} required /></div>
              <Input label="Nombre de colis" name="pieces" inputMode="numeric" value={form.pieces} onChange={set('pieces')} error={fieldError('pieces')} />
              <Input label="Poids (kg)" name="weightKg" inputMode="decimal" value={form.weightKg} onChange={set('weightKg')} placeholder="0,00" error={fieldError('weightKg')} required />
              <Input label="Volume (m³)" name="volumeCbm" inputMode="decimal" value={form.volumeCbm} onChange={set('volumeCbm')} placeholder="0,000" error={fieldError('volumeCbm')} required />
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-heading">Destinataire à Lomé</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Input label="Nom complet" name="clientName" value={form.clientName} onChange={set('clientName')} error={fieldError('clientName')} required /></div>
              <Input label="Téléphone WhatsApp" name="clientPhone" type="tel" value={form.clientPhone} onChange={set('clientPhone')} placeholder="+228 90 11 22 33" hint="Reçoit les alertes de statut" error={fieldError('clientPhone')} required />
              <Input label="Email (facultatif)" name="clientEmail" type="email" value={form.clientEmail} onChange={set('clientEmail')} error={fieldError('clientEmail')} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold text-heading">Photos de contrôle</h2>
            <PhotoPicker files={files} setFiles={setFiles} />
          </Card>
          <Card className="sticky top-24 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Montant estimé</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-heading">{fcfa(estimate)}</p>
            <p className="mt-1 text-xs text-muted">{mode === 'AIR' ? `${fcfa(TARIFFS.AIR_PER_KG)} / kg` : `${fcfa(TARIFFS.SEA_PER_CBM)} / m³`} — calculé définitivement par le serveur.</p>
            <Button type="submit" loading={busy} className="mt-6 w-full" size="lg">Enregistrer & notifier</Button>
          </Card>
        </div>
      </form>
    </>
  )
}

export function PhotoPicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  const add = (list: FileList | null) => {
    if (!list) return
    const ok = Array.from(list).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= 5 * 1024 * 1024)
    setFiles([...files, ...ok].slice(0, 8))
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
        className={cx('flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition', drag ? 'border-brand bg-brand-50' : 'border-line hover:border-slate-300 hover:bg-canvas')}
      >
        <ImagePlus className="size-6 text-brand" />
        <span className="mt-2 text-sm font-semibold text-heading">Ajouter des photos</span>
        <span className="text-xs text-muted">JPEG, PNG ou WebP · 5 Mo max · 8 photos</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {previews.map((u, i) => (
            <div key={u} className="group relative">
              <img src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-deep text-white opacity-0 transition group-hover:opacity-100" aria-label="Retirer"><X className="size-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
