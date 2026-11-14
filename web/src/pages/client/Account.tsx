import { CheckCircle2, KeyRound, Mail, Phone, Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { BackLink, ClientShell, PageHeader } from '../../components/AppShell'
import { channelLabel, DevCode } from '../../components/AuthLayout'
import { GoogleButton } from '../../components/GoogleButton'
import { OtpInput } from '../../components/OtpInput'
import { Alert, Button, Card, Input, PageLoader } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import type { AccountView, OtpSent } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function Account() {
  const { data, loading, setData } = useAsync(() => api.get<AccountView>('/account'), [])
  const [notice, setNotice] = useState<string | null>(null)
  const ok = (v: AccountView, msg: string) => { setData(v); setNotice(msg) }

  return (
    <ClientShell>
      <BackLink to="/espace" label="Mes colis" />
      <PageHeader title="Mon compte" text="Tous vos moyens de connexion sont liés au même compte et à vos colis." />
      {notice && <div className="mb-5"><Alert tone="success">{notice}</Alert></div>}
      {loading || !data ? <PageLoader /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Method icon={<Phone className="size-5" />} title="Téléphone WhatsApp" value={data.methods.phone?.value} verified={!!data.methods.phone?.verifiedAt}>
            <LinkIdentifier kind="phone" hasValue={!!data.methods.phone} onLinked={(v) => ok(v, 'Numéro WhatsApp vérifié et lié à votre compte.')} />
          </Method>
          <Method icon={<Mail className="size-5" />} title="Adresse e-mail" value={data.methods.email?.value} verified={!!data.methods.email?.verifiedAt}>
            <LinkIdentifier kind="email" hasValue={!!data.methods.email} onLinked={(v) => ok(v, 'Adresse e-mail vérifiée et liée à votre compte.')} />
          </Method>
          <Method icon={<GoogleG />} title="Compte Google" value={data.methods.google ? 'Lié' : undefined} verified={data.methods.google}>
            <GoogleLink linked={data.methods.google} canUnlink={!!(data.methods.phone || data.methods.email)} onChange={(v, m) => ok(v, m)} enabled={!!data.googleClientId} />
          </Method>
          <Method icon={<KeyRound className="size-5" />} title="Mot de passe" value={data.methods.password ? '••••••••••' : undefined} verified={data.methods.password}>
            <PasswordForm hasPassword={data.methods.password} onDone={(v) => ok(v, 'Mot de passe enregistré.')} />
          </Method>
        </div>
      )}
    </ClientShell>
  )
}

function Method({ icon, title, value, verified, children }: { icon: ReactNode; title: string; value?: string; verified: boolean; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-heading">{title}</p>
          {value ? (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink">{value}{verified && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="vérifié" />}</p>
          ) : <p className="mt-0.5 text-sm text-muted">Non configuré</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function LinkIdentifier({ kind, hasValue, onLinked }: { kind: 'phone' | 'email'; hasValue: boolean; onLinked: (v: AccountView) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [sent, setSent] = useState<OtpSent | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setErr('')
    try { await fn() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const start = (e: FormEvent) => { e.preventDefault(); run(async () => setSent(await api.post<OtpSent>('/account/link/start', { identifier: value }))) }
  const verify = (c = code) => run(async () => {
    onLinked(await api.post<AccountView>('/account/link/verify', { identifier: value, code: c }))
    setOpen(false); setSent(null); setValue(''); setCode('')
  })

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />{hasValue ? 'Changer' : 'Ajouter'}</Button>
  return (
    <div className="space-y-3 rounded-xl bg-canvas p-4">
      {err && <Alert>{err}</Alert>}
      {!sent ? (
        <form onSubmit={start} className="space-y-3">
          <Input name={kind} type={kind === 'email' ? 'email' : 'tel'} placeholder={kind === 'email' ? 'vous@gmail.com' : '90 11 22 33'} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={value.trim().length < 3}>Envoyer un code</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      ) : (
        <>
          <DevCode code={sent.devCode} />
          <p className="text-sm">Code envoyé {channelLabel(sent.channel)} au <span className="font-semibold">{sent.destination}</span>.</p>
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
          <Button size="sm" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>Vérifier</Button>
        </>
      )}
    </div>
  )
}

function GoogleLink({ linked, canUnlink, enabled, onChange }: { linked: boolean; canUnlink: boolean; enabled: boolean; onChange: (v: AccountView, msg: string) => void }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!enabled) return <p className="text-xs text-muted">La connexion Google n’est pas encore activée par Kader Cargo.</p>
  if (linked) {
    return (
      <>
        {err && <div className="mb-2"><Alert>{err}</Alert></div>}
        <Button variant="ghost" size="sm" loading={busy} disabled={!canUnlink} onClick={async () => {
          setBusy(true)
          try { onChange(await api.del<AccountView>('/account/link/google'), 'Compte Google dissocié.') } catch (e) { setErr(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
        }}>Dissocier</Button>
      </>
    )
  }
  return (
    <>
      {err && <div className="mb-2"><Alert>{err}</Alert></div>}
      <div className="-mt-5"><GoogleButton text="continue_with" onCredential={async (credential) => {
        try { onChange(await api.post<AccountView>('/account/link/google', { credential }), 'Compte Google lié : vous pouvez vous connecter avec Google.') } catch (e) { setErr(e instanceof ApiError ? e.message : 'Erreur') }
      }} /></div>
    </>
  )
}

function PasswordForm({ hasPassword, onDone }: { hasPassword: boolean; onDone: (v: AccountView) => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{hasPassword ? 'Modifier' : 'Créer un mot de passe'}</Button>
  return (
    <form className="space-y-3 rounded-xl bg-canvas p-4" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setErr(null)
      try { onDone(await api.post<AccountView>('/account/password', { ...(hasPassword && { currentPassword: current }), newPassword: next })); setOpen(false); setCurrent(''); setNext('') }
      catch (e) { setErr(e instanceof ApiError ? e : null) } finally { setBusy(false) }
    }}>
      {err && !err.fields && <Alert>{err.message}</Alert>}
      {hasPassword && <Input label="Mot de passe actuel" name="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
      <Input label="Nouveau mot de passe" name="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="10 caractères minimum" error={err?.fields?.find((f) => f.path === 'newPassword')?.message} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={next.length < 10}>Enregistrer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-7.9z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  )
}
