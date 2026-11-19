import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { signInWithEmail, signUpWithEmail, signOutUser } from '../firebase/auth'
import { ensureUserProfile, getUserProfile, updateUserProfile } from '../firebase/users'
import { getAuthErrorMessage } from '../utils/authErrors'
import { getBrowserLocation } from '../utils/getBrowserLocation'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let user
      try {
        user = await signInWithEmail(email, password)
      } catch (signInErr) {
        if (signInErr.code === 'auth/user-not-found') {
          try {
            sessionStorage.setItem('relieftrack_new_signup', 'true')
          } catch {
            // non-fatal
          }
          user = await signUpWithEmail(email, password)
        } else {
          throw signInErr
        }
      }
      await ensureUserProfile(user)
      const profile = await getUserProfile(user.uid)
      if (profile?.status === 'Deleted') {
        await signOutUser()
        setError('This account has been deleted by an administrator. Please contact admin@relieftrack.com.')
        return
      }
      if (profile?.status === 'On Hold' && profile?.role !== 'Admin') {
        await signOutUser()
        setError('Your account has been placed on hold by the administrator. Please contact admin@relieftrack.com.')
        return
      }
      const loc = await getBrowserLocation()
      if (loc) updateUserProfile(user.uid, { location: loc })
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
      navigate(adminEmail && user.email === adminEmail ? '/admin' : '/home')
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Sign in failed. Please try again.')
      if (message) setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="title">Welcome back</h2>
      <p className="subtitle">Sign in to continue</p>

      {error && <p className="auth-error">{error}</p>}

      <form onSubmit={handleLogin}>
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="eye-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="row-options">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
            />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="forgot">
            Forgot password?
          </Link>
        </div>

        <button className="btn-login" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="signup-row">
        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </AuthLayout>
  )
}