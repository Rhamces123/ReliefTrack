import { useEffect, useState, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { getDeviceDocRef, getBrowserName, getOsName } from '../firebase/devices'
import { getBrowserLocation } from '../utils/getBrowserLocation'

export default function DeviceApprovalPage() {
  const {
    user,
    loading,
    deviceId,
    deviceBlocked,
    deviceInfo,
    emailState,
    handleDeviceTrusted,
    handleDeviceRejected,
    resendApprovalEmail,
  } = useAuth()
  const navigate = useNavigate()
  const [location, setLocation] = useState('')
  const [resending, setResending] = useState(false)
  const [denied, setDenied] = useState(false)
  const processedRef = useRef(false)

  useEffect(() => {
    let mounted = true
    getBrowserLocation()
      .then((loc) => {
        if (mounted && loc) setLocation(loc)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!user || !deviceId || !deviceBlocked) return
    const ref = getDeviceDocRef(user.uid, deviceId)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists() || processedRef.current) return
      const data = snap.data()
      if (data.isTrusted) {
        processedRef.current = true
        handleDeviceTrusted()
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
        navigate(adminEmail && user.email === adminEmail ? '/admin' : '/home', { replace: true })
      } else if (data.rejected) {
        processedRef.current = true
        setDenied(true)
        setTimeout(() => handleDeviceRejected(), 2500)
      }
    })
    return () => unsubscribe()
  }, [user, deviceId, deviceBlocked, handleDeviceTrusted, handleDeviceRejected, navigate])

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!deviceBlocked) {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    return <Navigate to={adminEmail && user.email === adminEmail ? '/admin' : '/home'} replace />
  }

  const timeString = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const handleResend = async () => {
    setResending(true)
    await resendApprovalEmail()
    setResending(false)
  }

  if (denied) {
    return (
      <div className="ndv-backdrop">
        <div className="ndv-card">
          <div className="ndv-icon">🛡️</div>
          <h3 className="ndv-title">Login rejected</h3>
          <p className="ndv-text">
            This login was rejected from your email. Your account is protected and this device will
            be signed out.
          </p>
          <div className="ndv-actions">
            <button className="ndv-btn ndv-btn-ghost" disabled>
              Signing you out…
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ndv-backdrop">
      <div className="ndv-card">
        <div className="ndv-icon">📧</div>
        <h3 className="ndv-title">Check your email</h3>
        <p className="ndv-text">
          A login from a new device needs your confirmation. We sent an approval request to{' '}
          <strong>{user.email}</strong>.
        </p>

        <div className="ndv-details">
          <div className="ndv-info-row">
            <span className="ndv-label">Device</span>
            <span className="ndv-value">
              {deviceInfo?.browser || getBrowserName()} • {deviceInfo?.operatingSystem || getOsName()}
            </span>
          </div>
          {location && (
            <div className="ndv-info-row">
              <span className="ndv-label">Location</span>
              <span className="ndv-value">{location}</span>
            </div>
          )}
          <div className="ndv-info-row">
            <span className="ndv-label">Time</span>
            <span className="ndv-value">{timeString}</span>
          </div>
          <div className="ndv-info-row">
            <span className="ndv-label">Status</span>
            <span className="ndv-value ndv-untrusted">Awaiting your approval</span>
          </div>
        </div>

        {emailState === 'sending' && (
          <div className="ndv-actions">
            <div className="ndv-spinner" />
            <p className="devp-hint">Sending approval email…</p>
          </div>
        )}

        {emailState === 'sent' && (
          <div className="ndv-actions">
            <div className="ndv-spinner" />
            <p className="devp-hint">
              Open <strong>{user.email}</strong>, then tap <strong>Approve</strong> or{' '}
              <strong>Reject</strong> in the email you received. This page updates automatically.
            </p>
          </div>
        )}

        {emailState === 'error' && (
          <div className="ndv-actions">
            <p className="devp-warn">
              We couldn&apos;t send the email. Make sure the server can reach the mail service.
            </p>
            <button className="ndv-btn ndv-btn-primary" onClick={handleResend} disabled={resending}>
              {resending ? 'Sending…' : 'Resend email'}
            </button>
          </div>
        )}

        <button className="ndv-btn ndv-btn-ghost" onClick={() => handleDeviceRejected(false)}>
          Cancel and sign out
        </button>
        <p className="ndv-hint">Device ID: {deviceId ? deviceId.slice(0, 8) : ''}…</p>
      </div>
    </div>
  )
}