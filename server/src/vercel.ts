/**
 * Vercel serverless entry point: the whole Express API in one function.
 * Routing (see scripts/vercel-build.mjs) sends /api/* here as /api?__path=<rest>; the original
 * URL is rebuilt so Express sees exactly what the browser requested.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from './app'

const app = createApp()

export function restoreUrl(rawUrl: string): string {
  const u = new URL(rawUrl, 'http://internal')
  const rest = u.searchParams.get('__path')
  if (rest === null) return rawUrl // the platform already passed the original URL
  u.searchParams.delete('__path')
  const qs = u.searchParams.toString()
  return `/api/${rest.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = restoreUrl(req.url ?? '/')
  return app(req as never, res as never)
}
