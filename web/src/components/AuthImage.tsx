import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { cx } from './ui'

/** Loads a protected image through the authenticated API client (cookies + refresh). */
export function AuthImage({ path, alt, className, onClick }: { path: string; alt: string; className?: string; onClick?: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let revoke: string | null = null
    api.blobUrl(path).then((u) => { revoke = u; setUrl(u) }).catch(() => setFailed(true))
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [path])
  if (failed) return <div className={cx('grid place-items-center bg-slate-100 text-slate-400', className)}><ImageOff className="size-5" /></div>
  if (!url) return <div className={cx('animate-pulse bg-slate-100', className)} />
  return (
    <button type="button" onClick={() => onClick?.(url)} className={cx('group overflow-hidden', onClick && 'cursor-zoom-in')}>
      <img src={url} alt={alt} className={cx('object-cover transition duration-500 group-hover:scale-[1.03]', className)} />
    </button>
  )
}

export function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 grid animate-fade-up place-items-center bg-navy/80 p-6 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <img src={url} alt="Photo de contrôle" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl" />
    </div>
  )
}
