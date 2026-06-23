import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const dest = user
    ? (adminEmail && user.email === adminEmail ? '/admin' : '/home')
    : '/login'
  return <Navigate to={dest} replace />
}
