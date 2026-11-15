/**
 * Vercel serverless entry point: the whole Express API in one function.
 * Routing (see scripts/vercel-build.mjs) sends /api/* here as /api?__path=<rest>; the original
 * URL is rebuilt so Express sees exactly what the browser requested.
 *
 * The app is loaded lazily so that a startup failure (typically a missing or malformed
 * environment variable) is answered as JSON the site can display, instead of the platform's
 * bare "500 / FUNCTION_INVOCATION_FAILED" page.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ConfigError } from './lib/configError'

type App = (req: never, res: never) => void
let appPromise: Promise<App> | null = null

function loadApp(): Promise<App> {
  appPromise ??= import('./app').then((m) => m.createApp() as unknown as App)
  // A failed start is retried on the next request (e.g. after the variables are fixed and redeployed).
  appPromise.catch(() => { appPromise = null })
  return appPromise
}

export function restoreUrl(rawUrl: string): string {
  const u = new URL(rawUrl, 'http://internal')
  const rest = u.searchParams.get('__path')
  if (rest === null) return rawUrl // the platform already passed the original URL
  u.searchParams.delete('__path')
  const qs = u.searchParams.toString()
  return `/api/${rest.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`
}

/** JSON body for a startup failure: configuration errors are named (they hold no secret), others are not. */
export function startupFailure(err: unknown) {
  const message = err instanceof ConfigError
    ? `Configuration du serveur incomplète : ${err.message}. Corrigez-la dans Vercel (Settings → Environment Variables) puis redéployez.`
    : 'Le serveur n’a pas pu démarrer. Consultez les journaux de la fonction dans Vercel (onglet Logs).'
  return { error: { code: 'server_misconfigured', message } }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = restoreUrl(req.url ?? '/')
  let app: App
  try {
    app = await loadApp()
  } catch (err) {
    console.error('[startup]', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(startupFailure(err)))
    return
  }
  return app(req as never, res as never)
}
