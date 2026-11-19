import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { signUpWithEmail, signOutUser } from '../firebase/auth'
import { createUserProfile, updateUserProfile } from '../firebase/users'
import { getAuthErrorMessage } from '../utils/authErrors'
import { getBrowserLocation } from '../utils/getBrowserLocation'
import { validatePassword, getPasswordValidationState } from '../utils/passwordValidator'
import { validateGmail } from '../utils/emailValidator'

export default function SignUp() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [emailCustomError, setEmailCustomError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const pwRules = getPasswordValidationState(password)
  const gmailError = validateGmail(email)
  const isGmailValid = email.trim().length > 0 && !gmailError && !emailCustomError
  const hasEmailError = emailTouched && (Boolean(emailCustomError) || (email.trim().length > 0 && Boolean(gmailError)))
  const displayEmailError = emailCustomError || (emailTouched && email.trim().length > 0 ? gmailError : '')

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    const gmailErr = validateGmail(email)
    if (gmailErr) {
      setEmailTouched(true)
      setEmailCustomError(gmailErr)
      setError(gmailErr)
      return
    }

    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
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
      if (err?.code === 'auth/email-already-in-use') {
        setEmailTouched(true)
        setEmailCustomError('This Gmail address is already registered.')
      } else if (err?.code === 'auth/invalid-email') {
        setEmailTouched(true)
        setEmailCustomError('This Gmail address does not exist or is invalid.')
      }
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
    <AuthLayout allowScroll={true}>
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
          <label>Email (Gmail only)</label>
          <div className="input-wrap">
            <input
              className={`glass-input ${hasEmailError ? 'input-error' : ''} ${isGmailValid ? 'input-success' : ''}`}
              type="email"
              placeholder="yourname@gmail.com"
              value={email}
              onChange={(e) => {
                const val = e.target.value
                setEmail(val)
                setEmailCustomError('')
                if (val.includes('@') || emailTouched) {
                  setEmailTouched(true)
                }
              }}
              onBlur={() => {
                if (email.trim().length > 0) setEmailTouched(true)
              }}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>
          {hasEmailError && (
            <div className="field-error-text" role="alert">
              <span>⚠</span> {displayEmailError}
            </div>
          )}
          {isGmailValid && (
            <div className="field-success-text">
              <span>✓</span> Valid Gmail address
            </div>
          )}
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
              autoComplete="new-password"
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

          <div className="password-rules" aria-live="polite">
            <div className="password-rules-header">Password Requirements</div>
            <div className={`rule-item ${pwRules.startsWithCapital ? 'valid' : ''}`}>
              <span className="rule-icon">{pwRules.startsWithCapital ? '✓' : '•'}</span> Starts with a capital letter (A-Z)
            </div>
            <div className={`rule-item ${pwRules.hasMinLength ? 'valid' : ''}`}>
              <span className="rule-icon">{pwRules.hasMinLength ? '✓' : '•'}</span> At least 8 characters
            </div>
            <div className={`rule-item ${pwRules.hasNumber ? 'valid' : ''}`}>
              <span className="rule-icon">{pwRules.hasNumber ? '✓' : '•'}</span> At least one number (0-9)
            </div>
            <div className={`rule-item ${pwRules.hasSymbol ? 'valid' : ''}`}>
              <span className="rule-icon">{pwRules.hasSymbol ? '✓' : '•'}</span> At least one symbol (e.g. !@#$%^&*)
            </div>
          </div>
        </div>

        <div className="field">
          <label>Confirm password</label>
          <div className="input-wrap">
            <input
              className="glass-input"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="eye-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
