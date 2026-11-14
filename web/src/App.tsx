import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { PageLoader } from './components/ui'
import { isStaff, useAuth } from './lib/auth'
import type { Role } from './lib/types'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Track from './pages/Track'

// Authenticated areas are code-split: the public site stays tiny and instant.
const Login = lazy(() => import('./pages/Login'))
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'))
const ClientShipment = lazy(() => import('./pages/client/ShipmentPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const Shipments = lazy(() => import('./pages/admin/Shipments'))
const NewShipment = lazy(() => import('./pages/admin/NewShipment'))
const ShipmentAdmin = lazy(() => import('./pages/admin/ShipmentAdmin'))
const Containers = lazy(() => import('./pages/admin/Containers'))
const ContainerDetail = lazy(() => import('./pages/admin/ContainerDetail'))
const Users = lazy(() => import('./pages/admin/Users'))

/** UX guard only — every endpoint enforces authentication and RBAC server-side. */
function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={isStaff(user) ? '/admin' : '/espace'} replace />
  return <>{children}</>
}

const S = (el: ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>
const STAFF: Role[] = ['AGENT_GZ', 'AGENT_LOME', 'ADMIN']

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/suivi', element: <Track /> },
      { path: '/suivi/:trackingId', element: <Track /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/connexion', element: S(<Login />) },
  { path: '/espace', element: <Guard roles={['CLIENT']}>{S(<ClientDashboard />)}</Guard> },
  { path: '/espace/colis/:id', element: <Guard roles={['CLIENT']}>{S(<ClientShipment />)}</Guard> },
  {
    path: '/admin',
    element: <Guard roles={STAFF}>{S(<AdminLayout />)}</Guard>,
    children: [
      { index: true, element: S(<Overview />) },
      { path: 'colis', element: S(<Shipments />) },
      { path: 'colis/nouveau', element: <Guard roles={['AGENT_GZ', 'ADMIN']}>{S(<NewShipment />)}</Guard> },
      { path: 'colis/:id', element: S(<ShipmentAdmin />) },
      { path: 'conteneurs', element: S(<Containers />) },
      { path: 'conteneurs/:id', element: S(<ContainerDetail />) },
      { path: 'utilisateurs', element: <Guard roles={['ADMIN']}>{S(<Users />)}</Guard> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
