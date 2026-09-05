import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getBrowserLocation } from '../utils/getBrowserLocation'
import { getBrowserName, getOsName } from '../firebase/devices'

export default function NewDeviceModal() {
  const { deviceBlocked, deviceInfo, deviceId, handleDeviceTrusted, handleDeviceRejected } = useAuth()
  const [location, setLocation] = useState('')
  const [denied, setDenied] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!deviceBlocked) return
    let mounted = true
    getBrowserLocation().then((loc) => {
      if (mounted && loc) setLocation(loc)
    })
    return () => {
      mounted = false
    }
  }, [deviceBlocked])

  if (!deviceBlocked) return null

  const now = new Date()
  const timeString = now.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const handleYes = async () => {
    setWorking(true)
    await handleDeviceTrusted()
    setWorking(false)
  }

  const handleNo = async () => {
    setDenied(true)
  }

  const handleSecureAccount = async () => {
    setWorking(true)
    await handleDeviceRejected(true)
    setWorking(false)
  }

  if (denied) {
    return (
      <div className="ndv-backdrop">
        <div className="ndv-card">
          <div className="ndv-icon">🛡️</div>
          <h3 className="ndv-title">This wasn&apos;t you.</h3>
          <p className="ndv-text">Your account has been protected. You have been signed out of this device.</p>
          {deviceInfo && (
            <div className="ndv-info-row">
              <span className="ndv-label">Device</span>
              <span className="ndv-value">
                {deviceInfo.browser} • {deviceInfo.operatingSystem}
              </span>
            </div>
          )}
          <div className="ndv-actions">
            <button className="ndv-btn ndv-btn-primary" onClick={handleSecureAccount} disabled={working}>
              {working ? 'Securing...' : 'Secure my account'}
            </button>
            <button
              className="ndv-btn ndv-btn-ghost"
              onClick={() => handleDeviceRejected(false)}
              disabled={working}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ndv-backdrop">
      <div className="ndv-card">
        <div className="ndv-icon">💻</div>
        <h3 className="ndv-title">New Device Detected</h3>
        <p className="ndv-text">We noticed a login to your account from a new device.</p>

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
            <span className="ndv-value ndv-untrusted">Not yet trusted</span>
          </div>
        </div>

        <p className="ndv-question">Was this you?</p>

        <div className="ndv-actions">
          <button className="ndv-btn ndv-btn-primary" onClick={handleYes} disabled={working}>
            {working ? 'Confirming...' : "YES, IT WAS ME"}
          </button>
          <button className="ndv-btn ndv-btn-danger" onClick={handleNo} disabled={working}>
            NO, THIS WASN&apos;T ME
          </button>
        </div>
        <p className="ndv-hint">Device ID: {deviceId ? deviceId.slice(0, 8) : ''}…</p>
      </div>
    </div>
  )
}