import { Plus, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/AppShell'
import { Alert, Button, Card, Empty, Input, PageLoader, Select, cx } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { dateShort, ROLE_LABELS } from '../../lib/format'
import type { Role, User } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export default function Users() {
  const { user: me } = useAuth()
  const { data, loading, reload } = useAsync(() => api.get<{ users: User[] }>('/users'), [])
  const [open, setOpen] = useState(false)

  async function toggle(u: User) {
    await api.patch(`/users/${u.id}`, { active: !u.active })
    reload()
  }

  return (
    <>
      <PageHeader title="Utilisateurs" text="Comptes clients et personnel des agences." actions={<Button onClick={() => setOpen((o) => !o)}><Plus className="size-4" /> Nouveau compte</Button>} />
      {open && <CreateUser onDone={() => { setOpen(false); reload() }} />}
      <Card className="overflow-hidden">
        {loading ? <PageLoader /> : !data?.users.length ? <Empty icon={<UserRound className="size-5" />} title="Aucun utilisateur" /> : (
          <ul className="divide-y divide-line">
            {data.users.map((u) => (
              <li key={u.id} className={cx('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between', !u.active && 'opacity-50')}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-canvas text-xs font-bold text-navy">{u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                  <div>
                    <p className="font-semibold text-navy">{u.name}</p>
                    <p className="text-xs text-muted">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', u.role === 'CLIENT' ? 'bg-slate-100 text-slate-600' : 'bg-electric-50 text-electric-600')}>{ROLE_LABELS[u.role]}</span>
                  <span className="hidden text-xs text-muted md:inline">Créé le {dateShort(u.createdAt)}</span>
                  {u.id !== me?.id && <Button size="sm" variant="ghost" onClick={() => toggle(u)}>{u.active ? 'Désactiver' : 'Réactiver'}</Button>}
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
