import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import GoogleButton from '../components/GoogleButton'
import { signInWithEmail, signInWithGoogle, signUpWithEmail, handleRedirectResult } from '../firebase/auth'
import { ensureUserProfile, updateUserProfile } from '../firebase/users'
import { getAuthErrorMessage } from '../utils/authErrors'
import { getBrowserLocation } from '../utils/getBrowserLocation'

export default function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    handleRedirectResult()
      .then((user) => {
        if (!user) { setLoading(false); return }
        return ensureUserProfile(user).then(() => {
          getBrowserLocation()
            .then((loc) => { if (loc) updateUserProfile(user.uid, { location: loc }) })
            .catch(() => {})
          const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
          navigate(adminEmail && user.email === adminEmail ? '/admin' : '/home', { replace: true })
        })
      })
      .catch(() => setLoading(false))
  }, [navigate])

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
          user = await signUpWithEmail(email, password)
        } else {
          throw signInErr
        }
      }
      await ensureUserProfile(user)
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
      navigate(adminEmail && user.email === adminEmail ? '/admin' : '/home')
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Sign in failed. Please try again.')
      if (message) setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    setError('')
    signInWithGoogle()
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
          <a href="#" className="forgot" onClick={(e) => e.preventDefault()}>
            Forgot password?
          </a>
        </div>

        <button className="btn-login" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="divider">
        <span>or continue with</span>
      </div>

      <GoogleButton onClick={handleGoogle} disabled={loading} />

      <p className="signup-row">
        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </AuthLayout>
  )
}
