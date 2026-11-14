import { Camera, Download, FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { dateLong, fcfa, num } from '../lib/format'
import type { Shipment } from '../lib/types'
import { AuthImage, Lightbox } from './AuthImage'
import { EventHistory, modeLabel, ModeIcon, StatusBadge, StatusStepper } from './status'
import { Button, Card } from './ui'

/** Shared detail view (client + staff). Staff-only panels are injected through `aside` / `actions`. */
export function ShipmentView({ s, actions, aside, staff = false }: { s: Shipment; actions?: ReactNode; aside?: ReactNode; staff?: boolean }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  async function invoice() {
    setDownloading(true)
    try { await api.download(`/shipments/${s.id}/invoice.pdf`, `facture-${s.trackingId}.pdf`) } finally { setDownloading(false) }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-line p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-wide text-heading">{s.trackingId}</h1>
              <StatusBadge status={s.status} label={s.statusLabel} />
            </div>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted"><ModeIcon mode={s.mode} /> {modeLabel(s.mode)} · {s.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions}
            <Button variant="outline" size="sm" onClick={invoice} loading={downloading}><FileText className="size-4" /> Facture PDF</Button>
          </div>
        </div>
        <div className="p-6 md:p-10"><StatusStepper status={s.status} mode={s.mode} events={s.events} /></div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold text-heading">Récapitulatif</h2>
            <dl className="mt-4 divide-y divide-line text-sm">
              <Row k="Montant" v={<span className="font-bold text-heading">{fcfa(s.priceXof)}</span>} />
              <Row k="Colis" v={`${s.pieces}`} />
              <Row k="Poids" v={`${num(s.weightKg)} kg`} />
              <Row k="Volume" v={`${num(s.volumeCbm, 3)} m³`} />
              <Row k="Lot / Conteneur" v={s.container?.code ?? 'Non assigné'} />
              {s.container?.etaAt && <Row k="Arrivée estimée" v={dateLong(s.container.etaAt)} />}
              <Row k="Réceptionné le" v={dateLong(s.createdAt)} />
              {staff && <Row k="Client" v={<span className="text-right">{s.clientName}<br /><span className="text-muted">{s.clientPhone}{s.clientEmail ? ` · ${s.clientEmail}` : ''}</span></span>} />}
              {staff && s.createdBy && <Row k="Saisi par" v={s.createdBy.name} />}
            </dl>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-heading">Photos de contrôle</h2>
              <span className="text-xs text-muted">{s.photos?.length ?? 0} photo{(s.photos?.length ?? 0) > 1 ? 's' : ''}</span>
            </div>
            {s.photos?.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {s.photos.map((p) => (
                  <AuthImage key={p.id} path={`/shipments/${s.id}/photos/${p.id}`} alt="Photo de contrôle qualité" className="aspect-square w-full rounded-xl" onClick={setLightbox} />
                ))}
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-canvas px-4 py-6 text-sm text-muted"><Camera className="size-4" /> Aucune photo pour ce colis.</p>
            )}
            {s.photos && s.photos.length > 0 && !staff && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Download className="size-3" /> Cliquez sur une photo pour l’agrandir.</p>
            )}
          </Card>
          {aside}
        </div>

        <Card className="self-start p-6">
          <h2 className="font-semibold text-heading">Historique</h2>
          <div className="mt-6"><EventHistory events={s.events ?? []} showAuthor={staff} /></div>
        </Card>
      </div>
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  )
}
