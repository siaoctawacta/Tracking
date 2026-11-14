export type Role = 'CLIENT' | 'AGENT_GZ' | 'AGENT_LOME' | 'ADMIN'
export type Mode = 'SEA' | 'AIR'
export type Status = 'REGISTERED' | 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'READY' | 'DELIVERED'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: Role
  active?: boolean
  createdAt?: string
  // admin view
  approvalStatus?: ApprovalStatus
  signupMethod?: 'PHONE' | 'EMAIL' | 'GOOGLE' | 'ADMIN' | null
  phoneVerified?: boolean
  emailVerified?: boolean
  google?: boolean
}

export interface AccountView {
  user: User
  methods: {
    phone: { value: string; verifiedAt: string | null } | null
    email: { value: string; verifiedAt: string | null } | null
    google: boolean
    password: boolean
  }
  googleClientId: string | null
}

/** Response of the code-sending endpoints. `devCode` only exists in demo mode (no WhatsApp/SMTP configured). */
export interface OtpSent {
  channel: 'WHATSAPP' | 'EMAIL'
  destination: string
  devCode?: string
}

export type StaffNotificationType = 'ACCOUNT_PENDING' | 'CONTAINER_DEPARTED' | 'CONTAINER_ARRIVED' | 'SHIPMENT_ARRIVED' | 'WHATSAPP_FAILED'

export interface StaffNotification {
  id: string
  type: StaffNotificationType
  title: string
  body: string
  link: string | null
  createdAt: string
  unread: boolean
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
  step: Status | null
  to: string
  body: string
  status: 'PENDING' | 'SENT' | 'SIMULATED' | 'FAILED'
  error: string | null
  attempts: number
  sentAt: string | null
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
