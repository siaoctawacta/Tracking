/**
 * Creates (or promotes) an administrator account — used once on a new server instead of the demo seed.
 *
 *   npm run create-admin -- --name "Kader" --email admin@kadercargo.com [--phone "+228 90 94 44 48"]
 *
 * The password is asked interactively (not echoed), or read from ADMIN_PASSWORD for automation.
 */
import 'dotenv/config'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline'
import { prisma } from '../src/db'
import { normalizePhone } from '../src/lib/domain'
import { hashPassword } from '../src/lib/security'

const { values } = parseArgs({ options: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } } })

/** Asks questions on one readline interface, without echoing what is typed (passwords). */
function hiddenPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY ?? false })
  const out = rl as unknown as { _writeToOutput: (s: string) => void }
  const original = out._writeToOutput.bind(rl)
  let muted = false
  out._writeToOutput = (s: string) => { if (!muted) original(s) }
  const lines: string[] = []
  const waiting: ((l: string) => void)[] = []
  rl.on('line', (l) => { const w = waiting.shift(); if (w) w(l); else lines.push(l) })
  return {
    ask(question: string) {
      muted = false
      process.stdout.write(question)
      muted = true
      return new Promise<string>((resolve) => {
        const ready = lines.shift()
        if (ready !== undefined) { process.stdout.write('\n'); resolve(ready) }
        else waiting.push((l) => { process.stdout.write('\n'); resolve(l) })
      })
    },
    close: () => rl.close(),
  }
}

async function main() {
  const name = values.name?.trim()
  const email = values.email?.trim().toLowerCase()
  const phone = values.phone ? normalizePhone(values.phone) : undefined
  if (!name || (!email && !phone)) {
    console.error('Usage: npm run create-admin -- --name "Nom" --email admin@exemple.com [--phone "+228 …"]')
    process.exit(1)
  }
  let password = process.env.ADMIN_PASSWORD ?? ''
  if (!password) {
    const prompt = hiddenPrompt()
    password = await prompt.ask('Mot de passe (10 caractères min.) : ')
    const again = await prompt.ask('Confirmez le mot de passe : ')
    prompt.close()
    if (password !== again) throw new Error('Les mots de passe ne correspondent pas')
  }
  if (password.length < 10) throw new Error('Mot de passe trop court (10 caractères minimum)')

  const existing = await prisma.user.findFirst({ where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((o) => Object.keys(o).length) } })
  const now = new Date()
  const data = {
    name, role: 'ADMIN', active: true, approvalStatus: 'APPROVED', approvedAt: now, signupMethod: 'ADMIN',
    passwordHash: await hashPassword(password),
    ...(email ? { email, emailVerifiedAt: now } : {}),
    ...(phone ? { phone, phoneVerifiedAt: now } : {}),
  }
  const user = existing ? await prisma.user.update({ where: { id: existing.id }, data }) : await prisma.user.create({ data })
  console.log(`${existing ? 'Compte mis à jour' : 'Administrateur créé'} : ${user.name} (${user.email ?? user.phone})`)
}

main()
  .catch((e) => { console.error('Erreur :', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
