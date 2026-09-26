import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  // Prevent auto-redirect to /home while the registration success message is displayed on sign up
  const isSignupSuccess =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('relieftrack_signup_success') === 'true'
  if (isSignupSuccess) {
    return children
  }

  if (user) {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    const isAdmin = adminEmail && user.email === adminEmail
    return <Navigate to={isAdmin ? '/admin' : '/home'} replace />
  }

  return children
}
