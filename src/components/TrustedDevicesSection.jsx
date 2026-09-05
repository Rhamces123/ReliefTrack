import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listDevices, removeDevice, getDeviceId } from '../firebase/devices'
import { formatRelativeTime } from '../utils/formatTime'

export default function TrustedDevicesSection() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    let mounted = true
    if (!user?.uid) return
    listDevices(user.uid)
      .then((list) => {
        if (!mounted) return
        setDevices(list.sort((a, b) => (b.lastLogin?.seconds || 0) - (a.lastLogin?.seconds || 0)))
      })
      .catch(() => {
        if (mounted) setError('Failed to load devices.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user?.uid])

  const currentDeviceId = getDeviceId()

  const handleRemove = async (deviceId) => {
    if (!user?.uid) return
    setRemoving(deviceId)
    setError('')
    try {
      await removeDevice(user.uid, deviceId)
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
    } catch {
      setError('Failed to remove device.')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-icon">🖥️</span>
          <h3>Trusted Devices</h3>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Loading devices…</p>
      </div>
    )
  }

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <span className="settings-card-icon">🖥️</span>
        <h3>Trusted Devices</h3>
      </div>
      <p className="settings-devices-hint">
        These are the browsers and devices that can access your account without a security check.
      </p>

      {error && <div className="settings-devices-error">{error}</div>}

      {devices.length === 0 ? (
        <p className="settings-devices-empty">No trusted devices yet.</p>
      ) : (
        <div className="settings-devices-list">
          {devices.map((device) => {
            const isCurrent = device.id === currentDeviceId
            const lastActive =
              device.lastLogin?.seconds != null
                ? formatRelativeTime(device.lastLogin.seconds)
                : 'Recently'
            return (
              <div className="settings-device-row" key={device.id}>
                <div className="settings-device-icon">🖥️</div>
                <div className="settings-device-info">
                  <div className="settings-device-name">
                    {device.browser} • {device.operatingSystem}
                    {isCurrent && <span className="settings-device-current">This device</span>}
                  </div>
                  <div className="settings-device-meta">
                    {device.isTrusted ? 'Trusted' : 'Not trusted'} • Last active: {lastActive}
                  </div>
                </div>
                <button
                  className="settings-device-remove"
                  onClick={() => handleRemove(device.id)}
                  disabled={removing === device.id}
                >
                  {removing === device.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}