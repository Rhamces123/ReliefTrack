import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { signUpWithEmail, signOutUser } from '../firebase/auth'
import { createUserProfile, updateUserProfile } from '../firebase/users'
import { getAuthErrorMessage } from '../utils/authErrors'
import { getBrowserLocation } from '../utils/getBrowserLocation'

export default function SignUp() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      try {
        sessionStorage.setItem('relieftrack_new_signup', 'true')
        sessionStorage.setItem('relieftrack_signup_success', 'true')
      } catch {
        // non-fatal
      }
      const user = await signUpWithEmail(email, password, displayName.trim() || undefined)
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
      const role = adminEmail && user.email === adminEmail ? 'Admin' : 'Member'
      await createUserProfile(user.uid, {
        email: user.email,
        displayName: displayName.trim() || user.displayName || '',
        role,
        status: 'Active',
        isOnline: false,
      })
      try {
        const loc = await getBrowserLocation()
        if (loc) await updateUserProfile(user.uid, { location: loc })
      } catch {
        // Location lookup failure is non-fatal
      }

      setRegisteredEmail(user.email || email)
      await signOutUser()
      setSuccessModal(true)
    } catch (err) {
      try {
        sessionStorage.removeItem('relieftrack_signup_success')
      } catch {}
      const message = getAuthErrorMessage(err, 'Sign up failed. Please try again.')
      if (message) setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuccessOk = () => {
    try {
      sessionStorage.removeItem('relieftrack_signup_success')
    } catch {}
    navigate('/login', { replace: true, state: { email: registeredEmail } })
  }

  return (
    <AuthLayout>
      <h2 className="title">Create account</h2>
      <p className="subtitle">Sign up to get started</p>

      {error && <p className="auth-error">{error}</p>}

      <form onSubmit={handleSignUp}>
        <div className="field">
          <label>Name</label>
          <div className="input-wrap">
            <input
              className="glass-input"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <input
              className="glass-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="field">
          <label>Password</label>
          <div className="input-wrap">
            <input
              className="glass-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <span
              className="eye-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '🙈' : '👁️'}
            </span>
          </div>
        </div>

        <div className="field">
          <label>Confirm password</label>
          <div className="input-wrap">
            <input
              className="glass-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>

        <button className="btn-login" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="signup-row">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      {successModal && (
        <div className="auth-modal-overlay" role="dialog" aria-modal="true">
          <div className="auth-modal-card">
            <div className="auth-modal-icon">✅</div>
            <h3 className="auth-modal-title">Registration Successful!</h3>
            <p className="auth-modal-desc">
              Your account{registeredEmail ? <> (<strong className="auth-modal-email">{registeredEmail}</strong>)</> : ''} has been created successfully. Please sign in to continue.
            </p>
            <button
              type="button"
              className="auth-modal-btn"
              onClick={handleSuccessOk}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
