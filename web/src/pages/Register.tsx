import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout, channelLabel, DevCode, PendingApproval } from '../components/AuthLayout'
import { GoogleButton } from '../components/GoogleButton'
import { OtpInput } from '../components/OtpInput'
import { Alert, Button, Input } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { OtpSent, User } from '../lib/types'
import { useCountdown } from '../lib/useCountdown'

const Aside = () => (
  <>
    <p className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">Créez votre compte en 1 minute.</p>
    <ul className="mt-6 space-y-3 text-white/80">
      {['Tous vos colis liés à votre numéro et à votre e-mail', 'Alertes WhatsApp à chaque étape', 'Factures et photos de contrôle téléchargeables', 'Connexion par code, mot de passe ou Google'].map((t) => (
        <li key={t} className="flex items-center gap-3"><CheckCircle2 className="size-5 shrink-0 text-white" />{t}</li>
      ))}
    </ul>
  </>
)

export default function Register() {
  const { signedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', identifier: '', password: '' })
  const [sent, setSent] = useState<OtpSent | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<'WHATSAPP' | 'EMAIL' | 'GOOGLE' | null>(null)
  const countdown = useCountdown(60)
  const fe = (p: string) => error?.fields?.find((f) => f.path === p)?.message

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof ApiError ? e : new ApiError(0, 'network', 'Erreur réseau')) } finally { setBusy(false) }
  }

  const start = (e?: FormEvent) => {
    e?.preventDefault()
    run(async () => {
      setSent(await api.post<OtpSent>('/auth/register/start', form))
      setCode('')
      countdown.restart()
    })
  }

  const verify = (c = code) =>
    run(async () => {
      const r = await api.post<{ status: 'PENDING_APPROVAL' | 'SIGNED_IN'; user?: User }>('/auth/register/verify', { identifier: form.identifier, code: c })
      if (r.status === 'SIGNED_IN' && r.user) {
        signedIn(r.user)
        navigate('/espace', { replace: true })
      } else setPending(sent!.channel)
    })

  const google = (credential: string) =>
    run(async () => {
      const r = await api.post<{ status: 'SIGNED_IN' | 'PENDING_APPROVAL'; user?: User }>('/auth/google', { credential })
      if (r.status === 'SIGNED_IN' && r.user) { signedIn(r.user); navigate('/espace', { replace: true }) } else setPending('GOOGLE')
    })

  if (pending) return <AuthLayout title="Inscription" subtitle="Votre numéro est vérifié." aside={<Aside />}><PendingApproval channel={pending} /></AuthLayout>

  return (
    <AuthLayout title="Créer un compte" subtitle="Avec votre numéro WhatsApp ou votre adresse e-mail." aside={<Aside />}>
      {error && !error.fields && <div className="mb-4"><Alert>{error.message}</Alert></div>}
      {!sent ? (
        <form onSubmit={start} className="space-y-4" noValidate>
          <Input label="Nom complet" name="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fe('name')} required />
          <Input label="Téléphone WhatsApp ou e-mail" name="identifier" autoComplete="username" placeholder="90 11 22 33 ou vous@gmail.com" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} hint="Utilisez le numéro donné à votre fournisseur : vos colis y seront liés." error={fe('identifier')} required />
          <Input label="Mot de passe (facultatif)" name="new-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="10 caractères min. Sans mot de passe, vous vous connecterez avec un code." error={fe('password')} />
          <Button type="submit" loading={busy} className="w-full" disabled={!form.name.trim() || form.identifier.trim().length < 3}>Recevoir mon code de vérification</Button>
        </form>
      ) : (
        <div className="space-y-4">
          <DevCode code={sent.devCode} />
          <p className="text-sm text-ink">Saisissez le code reçu {channelLabel(sent.channel)} au <span className="font-semibold">{sent.destination}</span>.</p>
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} error={!!error} />
          <Button className="w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>Vérifier et créer mon compte</Button>
          <div className="flex items-center justify-between text-sm">
            <button className="cursor-pointer text-muted hover:text-heading" onClick={() => { setSent(null); setError(null) }}>Modifier</button>
            <button className="cursor-pointer font-semibold text-brand disabled:cursor-default disabled:text-muted" disabled={countdown.left > 0 || busy} onClick={() => start()}>
              {countdown.left > 0 ? `Renvoyer (${countdown.left} s)` : 'Renvoyer le code'}
            </button>
          </div>
        </div>
      )}
      <GoogleButton onCredential={google} text="signup_with" />
      <p className="mt-8 text-center text-sm text-muted">Déjà client ? <Link to="/connexion" className="font-semibold text-brand hover:underline">Se connecter</Link></p>
    </AuthLayout>
  )
}
