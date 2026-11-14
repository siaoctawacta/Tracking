import { KeyRound, MessageSquareText } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout, channelLabel, DevCode, PendingApproval } from '../components/AuthLayout'
import { GoogleButton } from '../components/GoogleButton'
import { OtpInput } from '../components/OtpInput'
import { Alert, Button, Input, cx } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { isStaff, useAuth } from '../lib/auth'
import type { OtpSent, User } from '../lib/types'
import { useCountdown } from '../lib/useCountdown'

type Mode = 'code' | 'password'

export default function Login() {
  const { user, login, signedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('code')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState<OtpSent | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<'WHATSAPP' | 'EMAIL' | 'GOOGLE' | null>(null)
  const countdown = useCountdown(60)

  const from = (location.state as { from?: string } | null)?.from
  if (user) return <Navigate to={from ?? (isStaff(user) ? '/admin' : '/espace')} replace />

  const done = (u: User) => {
    signedIn(u)
    navigate(from ?? (isStaff(u) ? '/admin' : '/espace'), { replace: true })
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'network', 'Connexion impossible. Vérifiez votre réseau.')
      if (err.code === 'account_pending') setPending(identifier.includes('@') ? 'EMAIL' : 'WHATSAPP')
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const u = await login(identifier, password)
      navigate(from ?? (isStaff(u) ? '/admin' : '/espace'), { replace: true })
    }).finally(() => setPassword(''))
  }

  const requestCode = (e?: FormEvent) => {
    e?.preventDefault()
    run(async () => {
      setSent(await api.post<OtpSent>('/auth/otp/request', { identifier }))
      setCode('')
      countdown.restart()
    })
  }

  const verify = (c = code) =>
    run(async () => {
      const r = await api.post<{ user: User }>('/auth/otp/verify', { identifier, code: c })
      done(r.user)
    })

  const google = (credential: string) =>
    run(async () => {
      const r = await api.post<{ status: 'SIGNED_IN' | 'PENDING_APPROVAL'; user?: User }>('/auth/google', { credential })
      if (r.status === 'PENDING_APPROVAL') setPending('GOOGLE')
      else done(r.user!)
    })

  if (pending) return <AuthLayout title="Connexion" subtitle="Votre compte n’est pas encore actif."><PendingApproval channel={pending} /></AuthLayout>

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à vos colis, factures et photos de contrôle.">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1" role="tablist">
        {([['code', 'Code WhatsApp / e-mail', <MessageSquareText key="i" className="size-4" />], ['password', 'Mot de passe', <KeyRound key="k" className="size-4" />]] as const).map(([m, label, icon]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setSent(null) }}
            className={cx('flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition sm:text-sm', mode === m ? 'bg-surface text-heading shadow-sm' : 'text-muted hover:text-heading')}>
            {icon}{label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><Alert>{error.message}</Alert></div>}

      {mode === 'password' ? (
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <Input label="Téléphone ou e-mail" name="identifier" autoComplete="username" placeholder="90 11 22 33 ou vous@gmail.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={busy} className="w-full" disabled={!identifier || !password}>Se connecter</Button>
        </form>
      ) : !sent ? (
        <form onSubmit={requestCode} className="space-y-4" noValidate>
          <Input label="Téléphone WhatsApp ou e-mail" name="identifier" autoComplete="username" placeholder="90 11 22 33 ou vous@gmail.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} hint="Nous vous envoyons un code à 6 chiffres." required />
          <Button type="submit" loading={busy} className="w-full" disabled={identifier.trim().length < 3}>Recevoir un code</Button>
        </form>
      ) : (
        <div className="space-y-4">
          <DevCode code={sent.devCode} />
          <p className="text-sm text-ink">Si un compte existe, un code a été envoyé {channelLabel(sent.channel)} au <span className="font-semibold">{sent.destination}</span>.</p>
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} error={!!error} />
          <Button className="w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>Valider le code</Button>
          <div className="flex items-center justify-between text-sm">
            <button className="cursor-pointer text-muted hover:text-heading" onClick={() => { setSent(null); setError(null) }}>Changer de numéro</button>
            <button className="cursor-pointer font-semibold text-brand disabled:cursor-default disabled:text-muted" disabled={countdown.left > 0 || busy} onClick={() => requestCode()}>
              {countdown.left > 0 ? `Renvoyer (${countdown.left} s)` : 'Renvoyer le code'}
            </button>
          </div>
        </div>
      )}

      <GoogleButton onCredential={google} />

      <p className="mt-8 text-center text-sm text-muted">
        Pas encore de compte ? <Link to="/inscription" className="font-semibold text-brand hover:underline">Créer un compte</Link>
      </p>
    </AuthLayout>
  )
}
