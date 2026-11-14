import { api } from './api'

/** Hosting limit per request is ~4.5 MB (Vercel): every photo is sent alone and kept well below it. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
/** Largest original accepted from the camera / gallery (it is compressed before upload). */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024

/**
 * Resizes a photo (longest side 1600 px, EXIF orientation applied) and re-encodes it as JPEG.
 * A 4–8 MB phone photo typically becomes 200–600 KB, still sharp enough for quality control.
 */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // unknown format: the server will validate it
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#ffffff' // transparent PNG → white background in JPEG
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  if (!blob) return file
  if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() })
}

/** Compresses then uploads photos one per request. Returns how many failed. */
export async function uploadPhotos(shipmentId: string, files: File[], onProgress?: (done: number, total: number) => void) {
  let failed = 0
  for (let i = 0; i < files.length; i++) {
    try {
      const photo = await compressPhoto(files[i])
      if (photo.size > MAX_UPLOAD_BYTES) throw new Error('too large')
      const fd = new FormData()
      fd.append('photos', photo)
      await api.post(`/shipments/${shipmentId}/photos`, fd)
    } catch {
      failed++
    }
    onProgress?.(i + 1, files.length)
  }
  return failed
}
