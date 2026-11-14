import { Boxes, Container, LayoutGrid, Users } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { StaffShell, type NavItem } from '../../components/AppShell'
import { useAuth } from '../../lib/auth'

export default function AdminLayout() {
  const { user } = useAuth()
  const nav: NavItem[] = [
    { to: '/admin', label: 'Vue d’ensemble', icon: <LayoutGrid className="size-[18px]" />, end: true },
    { to: '/admin/colis', label: 'Colis', icon: <Boxes className="size-[18px]" /> },
    { to: '/admin/conteneurs', label: 'Conteneurs', icon: <Container className="size-[18px]" /> },
  ]
  if (user?.role === 'ADMIN') nav.push({ to: '/admin/utilisateurs', label: 'Utilisateurs', icon: <Users className="size-[18px]" /> })
  return <StaffShell nav={nav}><Outlet /></StaffShell>
}
