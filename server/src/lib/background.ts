import { waitUntil } from '@vercel/functions'

/** True when running as a Vercel serverless function (the instance may freeze after the response). */
export const isServerless = () => process.env.VERCEL === '1'

/**
 * Runs work after the HTTP response without making the caller wait.
 * On Vercel, `waitUntil` keeps the function alive until the promise settles (within maxDuration);
 * elsewhere it is a no-op and the long-lived process simply finishes the promise.
 */
export function runInBackground(label: string, task: () => Promise<unknown>) {
  const p = task().catch((e) => console.error(`[background:${label}]`, e instanceof Error ? e.message : e))
  waitUntil(p)
  return p
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
