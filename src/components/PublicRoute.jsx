import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  if (user) {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    const isAdmin = adminEmail && user.email === adminEmail
    return <Navigate to={isAdmin ? '/admin' : '/home'} replace />
  }

  return children
}
