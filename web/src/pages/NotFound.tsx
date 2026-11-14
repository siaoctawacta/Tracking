import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-32 text-center">
      <p className="text-sm font-semibold text-electric">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy">Page introuvable</h1>
      <p className="mt-3 text-muted">Cette page n’existe pas ou a été déplacée.</p>
      <Link to="/" className="mt-8 inline-flex h-11 items-center rounded-xl bg-deep px-5 text-sm font-semibold text-white">Retour à l’accueil</Link>
    </div>
  )
}
