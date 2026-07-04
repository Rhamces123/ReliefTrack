import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { sendPasswordReset } from '../firebase/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="title">Reset password</h2>
      <p className="subtitle">Enter your email and we'll send you a reset link.</p>

      {error && <p className="auth-error">{error}</p>}

      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#22c55e', margin: '24px 0', fontSize: 15 }}>
            ✓ Reset link sent to <strong>{email}</strong>
          </p>
          <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>
            Check your inbox (and spam folder) for the password reset email.
          </p>
          <Link to="/login" className="btn-login" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
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

          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}

      {!sent && (
        <p className="signup-row" style={{ marginTop: 16 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      )}
    </AuthLayout>
  )
}