import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RootRedirect() {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return null
  }

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin =
    (adminEmail && user?.email?.toLowerCase() === adminEmail.toLowerCase()) ||
    userProfile?.role === 'Admin'
  const dest = user ? (isAdmin ? '/admin' : '/home') : '/login'
  return <Navigate to={dest} replace />
}
