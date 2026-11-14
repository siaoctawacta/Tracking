import { Lock, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/icons'
import { Alert, Button, Input } from '../components/ui'
import { ApiError } from '../lib/api'
import { isStaff, useAuth } from '../lib/auth'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from
  if (user) return <Navigate to={from ?? (isStaff(user) ? '/admin' : '/espace')} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(identifier, password)
      navigate(from ?? (isStaff(u) ? '/admin' : '/espace'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Vérifiez votre réseau.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="self-start"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold tracking-tight text-navy">Connexion</h1>
          <p className="mt-2 text-sm text-muted">Accédez à vos colis, factures et photos de contrôle.</p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {error && <Alert>{error}</Alert>}
            <Input
              label="Email ou téléphone"
              name="identifier"
              autoComplete="username"
              placeholder="vous@exemple.com ou 90 11 22 33"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Input
              label="Mot de passe"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={busy} className="w-full" disabled={!identifier || !password}>Se connecter</Button>
          </form>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted"><Lock className="size-3.5" /> Connexion chiffrée. Votre compte est créé par l’agence lors de votre premier envoi.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <div aria-hidden className="absolute -left-24 top-1/3 size-[28rem] rounded-full bg-electric/25 blur-3xl" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-end p-14">
          <ShieldCheck className="size-10 text-electric" />
          <p className="mt-6 max-w-md text-3xl font-bold leading-tight tracking-tight text-white">Toutes vos expéditions Chine → Togo, au même endroit.</p>
          <p className="mt-4 max-w-sm text-slate-300">Statuts en temps réel, factures téléchargeables et photos de vos marchandises prises à l’entrepôt.</p>
        </div>
      </div>
    </div>
  )
}
