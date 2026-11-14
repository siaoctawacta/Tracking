import { CheckCircle2, Hourglass, Mail, Phone, Plus, UserRound, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/AppShell'
import { Alert, Button, Card, Empty, Input, PageLoader, Select, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateShort, relative, ROLE_LABELS } from '../../lib/format'
import type { Role, User } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

const SIGNUP: Record<string, string> = { PHONE: 'Inscrit via WhatsApp', EMAIL: 'Inscrit par e-mail', GOOGLE: 'Inscrit avec Google', ADMIN: 'Créé par l’agence' }

export default function Users() {
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('filtre') === 'attente' ? 'pending' : 'all'
  const { data, loading, reload } = useAsync(
    () => api.get<{ users: User[]; pending: number }>(`/users${tab === 'pending' ? '?status=PENDING' : ''}`),
    [tab],
  )
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function toggle(u: User) {
    await api.patch(`/users/${u.id}`, { active: !u.active })
    reload()
  }

  async function decide(u: User, decision: 'APPROVE' | 'REJECT') {
    let reason: string | undefined
    if (decision === 'REJECT') {
      const r = window.prompt(`Refuser le compte de ${u.name} ? Motif (facultatif, envoyé au client) :`, '')
      if (r === null) return
      reason = r.trim() || undefined
    }
    try {
      const res = await api.post<{ notified: boolean }>(`/users/${u.id}/approval`, { decision, ...(reason && { reason }) })
      setMsg({
        tone: 'success',
        text: decision === 'APPROVE'
          ? `Compte de ${u.name} validé${res.notified ? ' — le client a été prévenu.' : '.'}`
          : `Compte de ${u.name} refusé${res.notified ? ' — le client a été prévenu.' : '.'}`,
      })
      reload()
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof ApiError ? e.message : 'Erreur' })
    }
  }

  const setTab = (t: 'pending' | 'all') => { setMsg(null); setParams(t === 'pending' ? { filtre: 'attente' } : {}, { replace: true }) }

  return (
    <>
      <PageHeader title="Utilisateurs" text="Validez les nouveaux comptes clients et gérez le personnel." actions={<Button onClick={() => setOpen((o) => !o)}><Plus className="size-4" /> Nouveau compte</Button>} />
      {open && <CreateUser onDone={() => { setOpen(false); reload() }} />}

      <div className="mb-4 inline-flex rounded-xl bg-surface p-1 ring-1 ring-line">
        {([['pending', 'À valider'], ['all', 'Tous les comptes']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cx('inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', tab === t ? 'bg-brand text-white' : 'text-muted hover:text-heading')}>
            {label}
            {t === 'pending' && !!data?.pending && <span className={cx('rounded-full px-1.5 text-xs', tab === t ? 'bg-white/20' : 'bg-brand-50 text-brand')}>{data.pending}</span>}
          </button>
        ))}
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      <Card className="overflow-hidden">
        {loading && !data ? <PageLoader /> : !data?.users.length ? (
          tab === 'pending'
            ? <Empty icon={<CheckCircle2 className="size-5" />} title="Aucun compte en attente" text="Les nouvelles inscriptions apparaîtront ici. Vous serez averti par une notification sonore." />
            : <Empty icon={<UserRound className="size-5" />} title="Aucun utilisateur" />
        ) : (
          <ul className="divide-y divide-line">
            {data.users.map((u) => (
              <li key={u.id} className={cx('flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between', !u.active && 'opacity-50')}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-xs font-bold text-heading">{u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-heading">
                      {u.name}
                      <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', u.role === 'CLIENT' ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand')}>{ROLE_LABELS[u.role]}</span>
                      {u.approvalStatus === 'PENDING' && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Hourglass className="size-3" />À valider</span>}
                      {u.approvalStatus === 'REJECTED' && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"><XCircle className="size-3" />Refusé</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {u.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{u.phone}{u.phoneVerified && <CheckCircle2 className="size-3 text-emerald-600" aria-label="vérifié" />}</span>}
                      {u.email && <span className="inline-flex items-center gap-1"><Mail className="size-3" />{u.email}{u.emailVerified && <CheckCircle2 className="size-3 text-emerald-600" aria-label="vérifié" />}</span>}
                      {u.google && <span>Google lié</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{u.signupMethod ? SIGNUP[u.signupMethod] : ''} · {u.approvalStatus === 'PENDING' ? relative(u.createdAt!) : `le ${dateShort(u.createdAt)}`}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {u.approvalStatus !== 'APPROVED' && <Button size="sm" onClick={() => decide(u, 'APPROVE')}><CheckCircle2 className="size-4" /> Valider</Button>}
                  {u.approvalStatus === 'PENDING' && <Button size="sm" variant="outline" onClick={() => decide(u, 'REJECT')}>Refuser</Button>}
                  {u.approvalStatus === 'APPROVED' && u.id !== me?.id && <Button size="sm" variant="ghost" onClick={() => toggle(u)}>{u.active ? 'Désactiver' : 'Réactiver'}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function CreateUser({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'CLIENT' as Role, password: '' })
  const [err, setErr] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const fe = (p: string) => err?.fields?.find((x) => x.path === p)?.message

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await api.post('/users', f)
      onDone()
    } catch (e) {
      setErr(e instanceof ApiError ? e : null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="mb-6 animate-fade-up p-6">
      <p className="mb-4 text-sm text-muted">Les comptes créés par l’agence sont actifs immédiatement.</p>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" autoComplete="off">
        <Input label="Nom complet" name="name" value={f.name} onChange={set('name')} error={fe('name')} required />
        <Select label="Rôle" value={f.role} onChange={set('role')}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Input label="Email" name="email" type="email" value={f.email} onChange={set('email')} error={fe('email')} />
        <Input label="Téléphone" name="phone" type="tel" value={f.phone} onChange={set('phone')} error={fe('phone')} hint="Doit correspondre au numéro des colis du client" />
        <Input label="Mot de passe initial" name="new-password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={fe('password')} hint="10 caractères minimum" required />
        <div className="flex items-end gap-2">
          <Button type="submit" loading={busy}>Créer le compte</Button>
        </div>
        {err && !err.fields && <div className="md:col-span-2"><Alert>{err.message}</Alert></div>}
      </form>
    </Card>
  )
}
