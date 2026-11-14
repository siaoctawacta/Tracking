/**
 * Vercel build (Build Output API v3): one deployment serves the site AND the API.
 *
 *   .vercel/output/static/          ← web/dist (the React site)
 *   .vercel/output/functions/api.func  ← the Express API bundled as one Node.js function
 *   .vercel/output/config.json      ← headers, static files, /api/* → function, SPA fallback, daily cron
 *
 * Database migrations run only for production deployments (VERCEL_ENV=production), so preview
 * deployments never change the production schema.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'
import { nodeFileTrace } from '@vercel/nft'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = path.join(root, '.vercel/output')
const fn = path.join(out, 'functions/api.func')
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: process.env })

fs.rmSync(out, { recursive: true, force: true })

console.log('→ Site (web/)')
run('npm run build', path.join(root, 'web'))
fs.cpSync(path.join(root, 'web/dist'), path.join(out, 'static'), { recursive: true })
for (const f of ['_headers', '_redirects']) fs.rmSync(path.join(out, 'static', f), { force: true })

const env = process.env.VERCEL_ENV ?? 'local'
if (env === 'production' && (process.env.DIRECT_URL || process.env.DATABASE_URL)) {
  console.log('→ Migrations PostgreSQL (production)')
  run('npx prisma migrate deploy', path.join(root, 'server'))
} else {
  console.log(`→ Migrations ignorées (environnement « ${env} »)`)
}

console.log('→ API (server/) → fonction')
const entry = path.join(root, 'server/dist/vercel.mjs')
await build({
  entryPoints: [path.join(root, 'server/src/vercel.ts')],
  outfile: entry,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external', // node_modules are copied as-is (native argon2, Prisma engine, pdfkit fonts)
  sourcemap: 'linked',
  logLevel: 'warning',
})
const { fileList, warnings } = await nodeFileTrace([entry], { base: root })
for (const w of warnings) if (!String(w.message).includes('Failed to resolve dependency')) console.warn('  nft:', w.message)
for (const file of fileList) {
  const src = path.join(root, file)
  const dst = path.join(fn, file)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  const stat = fs.lstatSync(src)
  if (stat.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(src), dst)
  else if (stat.isFile()) fs.copyFileSync(src, dst)
}
// Files loaded by name at run time, invisible to the tracer: pdfkit's standard fonts (Helvetica, Times…).
for (const dir of ['server/node_modules/pdfkit/js/data']) {
  fs.cpSync(path.join(root, dir), path.join(fn, dir), { recursive: true })
}
fs.writeFileSync(path.join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'server/dist/vercel.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  supportsResponseStreaming: true,
  maxDuration: 60,
}, null, 2))

const csp = "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/(?!api/)(.*)$', headers: {
      'Content-Security-Policy': csp,
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), identity-credentials-get=(self "https://accounts.google.com")',
    }, continue: true },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/api/(.*)$', dest: '/api?__path=$1' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
  crons: [{ path: '/api/v1/cron/maintenance', schedule: '15 5 * * *' }],
}, null, 2))

const size = fileList.size
console.log(`✓ Build Vercel prêt : site + fonction API (${size} fichiers tracés)`)
