import { PackageX } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { BackLink, ClientShell } from '../../components/AppShell'
import { ShipmentView } from '../../components/ShipmentView'
import { Card, Empty, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import type { Shipment } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function ClientShipmentPage() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(() => api.get<{ shipment: Shipment }>(`/shipments/${id}`), [id])
  return (
    <ClientShell>
      <BackLink to="/espace" label="Mes colis" />
      {loading ? <PageLoader /> : error ? (
        <Card><Empty icon={<PackageX className="size-5" />} title="Colis introuvable" text={error.message} /></Card>
      ) : <ShipmentView s={data!.shipment} />}
    </ClientShell>
  )
}
