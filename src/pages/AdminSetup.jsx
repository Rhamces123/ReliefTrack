import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUpWithEmail, signOutUser } from '../firebase/auth'
import { createUserProfile } from '../firebase/users'
import AuthLayout from '../components/AuthLayout'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@reliefrack.com'
const ADMIN_PASSWORD = 'Admin@123'

export default function AdminSetup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const user = await signUpWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin')
      await createUserProfile(user.uid, { email: ADMIN_EMAIL, displayName: 'Admin', role: 'Admin' })
      await signOutUser()
      setDone(true)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setDone(true)
      } else {
        setError(err.message || 'Setup failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 className="title" style={{ marginBottom: 8 }}>Admin Ready</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 }}>
            Email: <strong>{ADMIN_EMAIL}</strong>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 24 }}>
            Password: <strong>{ADMIN_PASSWORD}</strong>
          </p>
          <button className="btn-login" onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="title">Admin Setup</h2>
      <p className="subtitle">Create the admin account for ReliefTrack.</p>
      {error && <p className="auth-error">{error}</p>}
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12 }}>
          This will create an admin account with the following credentials:
        </p>
        <p style={{ color: '#fff', fontSize: 14, marginBottom: 6 }}>
          Email: <strong>{ADMIN_EMAIL}</strong>
        </p>
        <p style={{ color: '#fff', fontSize: 14, marginBottom: 0 }}>
          Password: <strong>{ADMIN_PASSWORD}</strong>
        </p>
      </div>
      <button className="btn-login" onClick={handleSetup} disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Creating...' : 'Create Admin Account'}
      </button>
    </AuthLayout>
  )
}
