/**
 * Thin client for the Kader Cargo REST API.
 * - Session JWTs live only in HttpOnly cookies (never readable here, never in localStorage).
 * - A CSRF token is fetched from the API and kept in memory, then echoed in X-CSRF-Token.
 * - On 401 the client silently rotates the refresh token once, then retries.
 */
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

export class ApiError extends Error {
  status: number
  code: string
  fields?: { path: string; message: string }[]
  constructor(status: number, code: string, message: string, fields?: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

/**
 * Error for a response that is not the expected JSON: the API's own error when it sent one,
 * otherwise a message saying the server (not the visitor's network) is at fault.
 */
function serverError(status: number, body: { error?: { code?: string; message?: string; fields?: ApiError['fields'] } } | null): ApiError {
  if (body?.error?.message) return new ApiError(status, body.error.code ?? 'error', body.error.message, body.error.fields)
  return status >= 500 || status === 0
    ? new ApiError(status, 'server_error', `Le serveur ne répond pas correctement (erreur ${status}). Réessayez dans quelques instants.`)
    : new ApiError(status, 'bad_response', 'Réponse inattendue du serveur : l’API n’est pas joignable à cette adresse.')
}

let csrfToken: string | null = null
let csrfPromise: Promise<string> | null = null
let refreshPromise: Promise<boolean> | null = null

async function getCsrf(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken
  csrfPromise ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' })
    .then(async (r) => {
      const b = await r.json().catch(() => null)
      if (!r.ok || typeof b?.csrfToken !== 'string') throw serverError(r.status, b)
      return (csrfToken = b.csrfToken as string)
    })
    .finally(() => (csrfPromise = null))
  return csrfPromise
}

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    const r = await raw('POST', '/auth/refresh')
    return r.ok
  })().finally(() => (refreshPromise = null))
  return refreshPromise
}

async function raw(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrf()
  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  }
  let res = await fetch(BASE + path, init)
  if (res.status === 403 && method !== 'GET') {
    const clone = res.clone()
    const err = await clone.json().catch(() => null)
    if (err?.error?.code === 'csrf_invalid') {
      headers['X-CSRF-Token'] = await getCsrf(true)
      res = await fetch(BASE + path, init)
    }
  }
  return res
}

async function request(method: string, path: string, body?: unknown, retry = true): Promise<Response> {
  let res = await raw(method, path, body)
  const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/refresh')
  if (res.status === 401 && retry && !isAuthRoute) {
    if (await refreshSession()) res = await raw(method, path, body)
  }
  if (!res.ok) {
    const b = await res.json().catch(() => null)
    if (!b?.error?.message && res.status >= 500) throw serverError(res.status, b)
    throw new ApiError(res.status, b?.error?.code ?? 'error', b?.error?.message ?? 'Une erreur est survenue', b?.error?.fields)
  }
  return res
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body)
  if (res.status === 204) return undefined as T
  try {
    return (await res.json()) as T
  } catch {
    throw serverError(res.status, null) // e.g. an HTML page where the API was expected
  }
}

export const api = {
  get: <T>(path: string) => json<T>('GET', path),
  post: <T>(path: string, body?: unknown) => json<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => json<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => json<T>('DELETE', path),
  /** Authenticated binary fetch (photos, PDFs) → object URL. */
  async blobUrl(path: string): Promise<string> {
    const res = await request('GET', path)
    return URL.createObjectURL(await res.blob())
  },
  async download(path: string, filename: string) {
    const url = await api.blobUrl(path)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
  async open(path: string) {
    const url = await api.blobUrl(path)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}
