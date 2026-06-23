import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import GoogleButton from '../components/GoogleButton'
import { signUpWithEmail, signInWithGoogle } from '../firebase/auth'
import { createUserProfile, ensureUserProfile, updateUserProfile } from '../firebase/users'
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
      const user = await signUpWithEmail(email, password, displayName.trim() || undefined)
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
      const role = adminEmail && user.email === adminEmail ? 'Admin' : 'Member'
      await createUserProfile(user.uid, {
        email: user.email,
        displayName: displayName.trim() || user.displayName || '',
        role,
      })
      navigate(role === 'Admin' ? '/admin' : '/home')
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Sign up failed. Please try again.')
      if (message) setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const user = await signInWithGoogle()
      await ensureUserProfile(user)
      getBrowserLocation()
        .then((loc) => {
          if (loc) updateUserProfile(user.uid, { location: loc })
        })
        .catch(() => {})
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
      navigate(adminEmail && user.email === adminEmail ? '/admin' : '/home')
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Google sign-in failed. Please try again.')
      if (message) setError(message)
    } finally {
      setLoading(false)
    }
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

      <div className="divider">
        <span>or continue with</span>
      </div>

      <GoogleButton onClick={handleGoogle} disabled={loading} />

      <p className="signup-row">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
