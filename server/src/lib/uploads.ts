import crypto from 'node:crypto'
import multer from 'multer'
import { config } from '../config'
import { HttpError } from '../middleware/errors'
import { photoStorage } from './storage'

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: 8, fields: 20 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED),
})

/** Checks magic bytes — the client-declared MIME type is never trusted on its own. */
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return null
}

export async function storePhoto(file: Express.Multer.File) {
  const mime = sniff(file.buffer)
  if (!mime || mime !== file.mimetype) throw new HttpError(400, 'Seules les images JPEG, PNG ou WebP sont acceptées', 'bad_file')
  const fileName = `${crypto.randomUUID()}.${ALLOWED[mime]}`
  await photoStorage().put(fileName, file.buffer, mime)
  return { fileName, mimeType: mime, size: file.size }
}
