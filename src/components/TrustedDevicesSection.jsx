import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listDevices, removeDevice, getDeviceId } from '../firebase/devices'
import { formatRelativeTime } from '../utils/formatTime'
import { Monitor, Smartphone, Laptop, Trash2, Loader2, AlertCircle } from 'lucide-react'

function getDeviceIcon(os = '', browser = '') {
  const str = `${os} ${browser}`.toLowerCase()
  if (
    str.includes('android') ||
    str.includes('ios') ||
    str.includes('iphone') ||
    str.includes('mobile')
  ) {
    return <Smartphone size={18} />
  }
  if (str.includes('mac') || str.includes('laptop')) {
    return <Laptop size={18} />
  }
  return <Monitor size={18} />
}

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
          <div className="settings-card-icon-wrap icon-navy">
            <Monitor size={20} />
          </div>
          <h3>Trusted Devices</h3>
        </div>
        <p className="settings-loading-text">
          <Loader2 size={16} className="spin-icon" />
          <span>Loading devices…</span>
        </p>
      </div>
    )
  }

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="settings-card-icon-wrap icon-navy">
          <Monitor size={20} />
        </div>
        <h3>Trusted Devices</h3>
      </div>
      <p className="settings-devices-hint">
        These are the browsers and devices that can access your account without repeated verification.
      </p>

      {error && (
        <div className="settings-devices-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {devices.length === 0 ? (
        <p className="settings-devices-empty">No trusted devices registered yet.</p>
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
                <div className="settings-device-icon-box">
                  {getDeviceIcon(device.operatingSystem, device.browser)}
                </div>
                <div className="settings-device-info">
                  <div className="settings-device-name">
                    <span>{device.browser || 'Browser'} on {device.operatingSystem || 'Device'}</span>
                    {isCurrent && <span className="settings-device-current">This device</span>}
                  </div>
                  <div className="settings-device-meta">
                    <span className="status-tag">{device.isTrusted ? 'Trusted' : 'Unverified'}</span>
                    <span className="separator">•</span>
                    <span>Last active: {lastActive}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-device-remove"
                  onClick={() => handleRemove(device.id)}
                  disabled={removing === device.id}
                  title="Remove trusted device"
                >
                  <Trash2 size={13} />
                  <span>{removing === device.id ? 'Removing…' : 'Remove'}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}