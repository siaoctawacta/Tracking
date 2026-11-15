import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import multer from 'multer'
import { diagnoseDbError, isDbUnavailable } from '../lib/dbErrors'

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Ressource introuvable' } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Données invalides',
        fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: { code: 'upload_error', message: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (5 Mo max)' : 'Envoi de fichier invalide' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'Requête trop volumineuse' } })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'JSON invalide' } })
  }
  if (isDbUnavailable(err)) {
    console.error(`[db] ${diagnoseDbError(err)}`, err)
    return res.status(503).json({ error: { code: 'database_unavailable', message: 'Service momentanément indisponible. Réessayez dans quelques instants.' } })
  }
  // Never leak internals (stack traces, SQL) to clients.
  console.error(err)
  res.status(500).json({ error: { code: 'internal', message: 'Erreur interne du serveur' } })
}
