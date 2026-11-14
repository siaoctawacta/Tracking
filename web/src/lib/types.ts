export type Role = 'CLIENT' | 'AGENT_GZ' | 'AGENT_LOME' | 'ADMIN'
export type Mode = 'SEA' | 'AIR'
export type Status = 'REGISTERED' | 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'READY' | 'DELIVERED'

export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: Role
  active?: boolean
  createdAt?: string
}

export interface TimelineEvent {
  id?: string
  status: Status
  label: string
  location: string
  note: string | null
  at?: string
  createdAt?: string
  createdBy?: { name: string } | null
}

export interface PublicTracking {
  trackingId: string
  mode: Mode
  status: Status
  statusLabel: string
  description: string
  pieces: number
  weightKg: number
  volumeCbm: number
  recipient: string
  recipientPhone: string
  origin: string
  destination: string
  container: { code: string; departureAt: string | null; etaAt: string | null } | null
  createdAt: string
  updatedAt: string
  events: TimelineEvent[]
}

export interface Container {
  id: string
  code: string
  mode: Mode
  state: 'OPEN' | 'CLOSED'
  departureAt: string | null
  etaAt: string | null
  closedAt: string | null
  createdAt: string
  count?: number
  weightKg?: number
  volumeCbm?: number
  status?: Status | null
  shipments?: Shipment[]
}

export interface Notification {
  id: string
  to: string
  body: string
  status: 'SENT' | 'SIMULATED' | 'FAILED'
  createdAt: string
}

export interface Shipment {
  id: string
  trackingId: string
  description: string
  mode: Mode
  status: Status
  statusLabel: string
  pieces: number
  weightKg: number
  volumeCbm: number
  priceXof: number
  clientName: string
  clientPhone: string
  clientEmail: string | null
  containerId: string | null
  container?: Partial<Container> | null
  createdAt: string
  updatedAt: string
  events?: TimelineEvent[]
  photos?: { id: string; mimeType: string; size: number; createdAt: string }[]
  notifications?: Notification[]
  createdBy?: { name: string }
  _count?: { photos: number }
}
