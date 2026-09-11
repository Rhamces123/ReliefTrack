import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOutUser } from '../firebase/auth'

export default function ProtectedRoute({ children }) {
  const { user, loading, deviceChecked, deviceBlocked, isAccountOnHold, userProfile } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0a0828' }} />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Account hold check: if account is held by admin, block access
  if (isAccountOnHold) {
    const handleSignOut = async () => {
      await signOutUser()
      navigate('/login')
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0828 0%, #17103a 50%, #001e32 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px',
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px',
            }}
          >
            ⏸️
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px', color: '#fef3c7' }}>
            Account On Hold
          </h2>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.75)', margin: '0 0 20px' }}>
            Your ReliefTrack account ({user.email}) has been placed on hold by the administrator. While on hold, access to ReliefTrack features and relief operations is suspended.
          </p>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '24px',
            }}
          >
            Contact the administrator at{' '}
            <strong style={{ color: '#93c5fd' }}>admin@relieftrack.com</strong> to review your account status.
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'linear-gradient(135deg, #7850ff 0%, #00c8c8 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
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