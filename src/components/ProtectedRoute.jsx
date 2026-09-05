import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading, deviceChecked, deviceBlocked } = useAuth()

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0a0828' }} />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // While device security is being evaluated, show a full-screen guard.
  if (!deviceChecked) {
    return (
      <div
        className="device-guard"
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0828 0%, #140a3c 50%, #001e32 100%)',
          color: '#fff',
          fontFamily: 'var(--sans)',
          fontSize: '14px',
        }}
      >
        <div className="ndv-spinner" />
      </div>
    )
  }

  // A new/unknown device must be approved from the user's email first.
  if (deviceBlocked) {
    return <Navigate to="/device-approval" replace />
  }

  return children
}