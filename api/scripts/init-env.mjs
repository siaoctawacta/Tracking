// Creates api/.env from .env.example with a freshly generated JWT secret (never overwrites).
import crypto from 'node:crypto'
import fs from 'node:fs'

const target = new URL('../.env', import.meta.url)
if (fs.existsSync(target)) {
  console.log('api/.env already exists — left untouched')
} else {
  const example = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  fs.writeFileSync(target, example.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('base64url')}`), { mode: 0o600 })
  console.log('api/.env created with a random JWT_SECRET')
}
