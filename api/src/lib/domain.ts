import crypto from 'node:crypto'

export const ROLES = ['CLIENT', 'AGENT_GZ', 'AGENT_LOME', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]
export const STAFF_ROLES: Role[] = ['AGENT_GZ', 'AGENT_LOME', 'ADMIN']

export const MODES = ['SEA', 'AIR'] as const
export type Mode = (typeof MODES)[number]

/** Ordered lifecycle of a parcel, Guangzhou → Lomé. */
export const STATUSES = ['REGISTERED', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'READY', 'DELIVERED'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  REGISTERED: 'Enregistré à Guangzhou',
  LOADING: 'En cours de chargement',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrivé à Lomé',
  READY: 'Disponible pour retrait',
  DELIVERED: 'Remis au client',
}

export function statusLabel(status: string, mode?: string): string {
  if (status === 'IN_TRANSIT') return mode === 'AIR' ? 'En vol' : 'En mer'
  if (status === 'ARRIVED') return mode === 'AIR' ? "Arrivé à l'aéroport de Lomé" : 'Arrivé au Port de Lomé'
  return STATUS_LABELS[status as Status] ?? status
}

export const STATUS_LOCATION: Record<Status, string> = {
  REGISTERED: 'Entrepôt Guangzhou, Chine',
  LOADING: 'Entrepôt Guangzhou, Chine',
  IN_TRANSIT: 'Chine → Togo',
  ARRIVED: 'Lomé, Togo',
  READY: 'Agence Lomé, Togo',
  DELIVERED: 'Agence Lomé, Togo',
}

/** Which statuses each role is allowed to set (RBAC on the business workflow). */
export const ROLE_STATUSES: Record<Role, Status[]> = {
  CLIENT: [],
  AGENT_GZ: ['REGISTERED', 'LOADING', 'IN_TRANSIT'],
  AGENT_LOME: ['ARRIVED', 'READY', 'DELIVERED'],
  ADMIN: [...STATUSES],
}

export function canSetStatus(role: Role, status: Status) {
  return ROLE_STATUSES[role].includes(status)
}

/** Tariffs (XOF). Sea freight is billed per CBM, air freight per kg. */
export const TARIFFS = { SEA_PER_CBM: 250_000, AIR_PER_KG: 9_500, MIN_CHARGE: 10_000 }

export function computePrice(mode: Mode, weightKg: number, volumeCbm: number): number {
  const raw = mode === 'AIR' ? weightKg * TARIFFS.AIR_PER_KG : volumeCbm * TARIFFS.SEA_PER_CBM
  return Math.max(TARIFFS.MIN_CHARGE, Math.round(raw / 100) * 100)
}

// Unambiguous alphabet (no 0/O, 1/I) — easier to read over the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomCode(len: number) {
  const bytes = crypto.randomBytes(len)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function newTrackingId(date = new Date()) {
  return `BC-${date.getFullYear()}-${randomCode(6)}`
}

export function newContainerCode(mode: Mode, date = new Date()) {
  return `${mode === 'AIR' ? 'AIR' : 'CT'}-${date.getFullYear()}-${randomCode(4)}`
}

/** Normalises a phone number to E.164-ish digits with leading + (defaults to Togo +228). */
export function normalizePhone(input: string): string {
  let p = input.replace(/[^\d+]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (!p.startsWith('+')) p = (p.length === 8 ? '+228' : '+') + p
  return p
}
