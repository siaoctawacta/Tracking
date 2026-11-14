import type { Role, Status } from './types'

export const STATUSES: Status[] = ['REGISTERED', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'READY', 'DELIVERED']

export const STATUS_SHORT: Record<Status, string> = {
  REGISTERED: 'Enregistré',
  LOADING: 'Chargement',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrivé à Lomé',
  READY: 'À retirer',
  DELIVERED: 'Remis',
}

export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Client',
  AGENT_GZ: 'Entrepôt Guangzhou',
  AGENT_LOME: 'Agence Lomé',
  ADMIN: 'Administrateur',
}

/** Mirror of the API's RBAC — used only to hide buttons; the API is the authority. */
export const ROLE_STATUSES: Record<Role, Status[]> = {
  CLIENT: [],
  AGENT_GZ: ['REGISTERED', 'LOADING', 'IN_TRANSIT'],
  AGENT_LOME: ['ARRIVED', 'READY', 'DELIVERED'],
  ADMIN: STATUSES,
}

export function stepLabel(status: Status, mode: 'SEA' | 'AIR') {
  if (status === 'IN_TRANSIT') return mode === 'AIR' ? 'En vol' : 'En mer'
  if (status === 'ARRIVED') return mode === 'AIR' ? 'Arrivé à Lomé' : 'Arrivé au port'
  return { REGISTERED: 'Enregistré à Guangzhou', LOADING: 'Chargement', READY: 'Disponible au retrait', DELIVERED: 'Remis au client' }[status]
}

export const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
export const num = (n: number, d = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n)

export const dateShort = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'
export const dateLong = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
export const dateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function relative(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute')
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour')
  return rtf.format(-Math.round(diff / 86400), 'day')
}

export const TRACKING_RE = /^BC-\d{4}-[A-Z0-9]{4,8}$/

export function normalizeTracking(input: string) {
  const v = input.trim().toUpperCase().replace(/\s+/g, '')
  return /^\d{4}-/.test(v) ? `BC-${v}` : v
}
