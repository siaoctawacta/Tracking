import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<User>
  /** Registers a session opened by another flow (code, Google, sign-up). */
  signedIn: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ user: User | null; refreshable: boolean }>('/auth/session')
      .then(async (r) => {
        if (r.user || !r.refreshable) return setUser(r.user)
        const refreshed = await api.post<{ user: User }>('/auth/refresh')
        setUser(refreshed.user)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await api.post<{ user: User }>('/auth/login', { identifier, password })
    setUser(r.user)
    return r.user
  }, [])

  const signedIn = useCallback((u: User) => setUser(u), [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, signedIn, logout }), [user, loading, login, signedIn, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export const isStaff = (u: User | null) => !!u && u.role !== 'CLIENT'
