import { useEffect, useState } from 'react'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { getUserProfile, updateUserProfile } from '../firebase/users'
import DashboardLayout from '../components/DashboardLayout'
import LocationAutocomplete from '../components/LocationAutocomplete'
import '../styles/Settings.css'

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Settings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [location, setLocation] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const displayNameFallback =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''
  const role = profile?.role || 'Member'
  const userLocation = profile?.location || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid)
      .then((p) => {
        setProfile(p)
        setDisplayName(p?.displayName || user?.displayName || '')
        setLocation(p?.location || '')
      })
      .catch(() => {})
  }, [user])

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!displayName.trim()) {
      setError('Display name cannot be empty.')
      return
    }
    setSaving(true)
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        location: location.trim(),
      })
      setProfile((p) => ({ ...p, displayName: displayName.trim(), location: location.trim() }))
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!currentPassword) {
      setError('Current password is required.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password changed successfully.')
    } catch (err) {
      setError(err.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout title="Settings" userLabel={displayNameFallback} userEmail={email}>
      <div className="settings-header">
        <div className="settings-header-text">
          <h2>Settings</h2>
          <p>Manage your account and profile preferences.</p>
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">👤</span>
            <h3>Profile Information</h3>
          </div>
          <div className="settings-profile-preview">
            <div className="dashboard-avatar">{getInitials(displayNameFallback)}</div>
            <div>
              <div className="settings-profile-name">{displayNameFallback}</div>
              <div className="settings-profile-email">{email}</div>
              <div className="settings-profile-role">{role}</div>
              {userLocation && <div className="settings-profile-location">{userLocation}</div>}
            </div>
          </div>
          <form onSubmit={handleProfileUpdate} className="settings-form">
            <div className="requests-form-field">
              <label htmlFor="settings-name">Display name</label>
              <input
                id="settings-name"
                type="text"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="requests-form-field">
              <label htmlFor="settings-email">Email</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                disabled
              />
            </div>
            <div className="requests-form-field">
              <label htmlFor="settings-location">Location</label>
              <LocationAutocomplete
                id="settings-location"
                value={location}
                onChange={setLocation}
                disabled={saving}
                placeholder="e.g. Barangay Mabolo, Naga City"
              />
            </div>
            <button type="submit" className="requests-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🔒</span>
            <h3>Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="settings-form">
            <div className="requests-form-field">
              <label htmlFor="settings-current-pw">Current password</label>
              <input
                id="settings-current-pw"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="requests-form-field">
              <label htmlFor="settings-new-pw">New password</label>
              <input
                id="settings-new-pw"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="requests-form-field">
              <label htmlFor="settings-confirm-pw">Confirm new password</label>
              <input
                id="settings-confirm-pw"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <button type="submit" className="requests-btn-primary" disabled={saving}>
              {saving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
