import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { getUserProfile, updateUserProfile } from '../firebase/users'
import { signOutUser } from '../firebase/auth'
import DashboardLayout from '../components/DashboardLayout'
import LocationAutocomplete from '../components/LocationAutocomplete'
import TrustedDevicesSection from '../components/TrustedDevicesSection'
import '../styles/Settings.css'
import {
  CircleUserRound,
  Lock,
  LogOut,
  Save,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Mail,
  MapPin,
  ShieldAlert,
} from 'lucide-react'

function getInitials(name) {
  if (!name) return 'RT'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
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

  const handleSignOut = async () => {
    setSigningOut(true)
    setError('')
    try {
      await signOutUser()
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Failed to sign out.')
      setSigningOut(false)
    }
  }

  return (
    <DashboardLayout title="Settings" userLabel={displayNameFallback} userEmail={email}>
      <div className="settings-header">
        <div className="settings-header-text">
          <h2>Settings & Preferences</h2>
          <p>Manage your ReliefTrack account credentials, profile details, and active sessions.</p>
        </div>
        <button
          type="button"
          className="settings-signout-btn"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out of ReliefTrack"
        >
          <LogOut size={16} />
          <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>

      {error && (
        <div className="settings-alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="settings-alert alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Profile Information Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-navy">
              <CircleUserRound size={20} />
            </div>
            <h3>Profile Information</h3>
          </div>

          <div className="settings-profile-preview">
            <div className="settings-avatar-wrap">
              <div className="settings-avatar">{getInitials(displayNameFallback)}</div>
            </div>
            <div className="settings-profile-meta">
              <div className="settings-profile-name">{displayNameFallback}</div>
              <div className="settings-profile-email">
                <Mail size={13} />
                <span>{email}</span>
              </div>
              <div className="settings-profile-badges">
                <span className={`role-pill ${role === 'Admin' ? 'pill-admin' : 'pill-member'}`}>
                  {role}
                </span>
                {userLocation && (
                  <span className="location-pill">
                    <MapPin size={12} />
                    <span>{userLocation}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="settings-form">
            <div className="requests-form-field">
              <label htmlFor="settings-name">Display Name</label>
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
              <label htmlFor="settings-email">Email Address</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                disabled
              />
              <span className="field-hint">Email is linked to your authentication provider and cannot be changed here.</span>
            </div>
            <div className="requests-form-field">
              <label htmlFor="settings-location">Assigned Location / Barangay</label>
              <LocationAutocomplete
                id="settings-location"
                value={location}
                onChange={setLocation}
                disabled={saving}
                placeholder="e.g. Barangay Mabolo, Naga City"
              />
            </div>
            <button type="submit" className="settings-btn-primary" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving changes...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-navy">
              <Lock size={20} />
            </div>
            <h3>Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="settings-form">
            <div className="requests-form-field">
              <label htmlFor="settings-current-pw">Current Password</label>
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
              <label htmlFor="settings-new-pw">New Password</label>
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
              <label htmlFor="settings-confirm-pw">Confirm New Password</label>
              <input
                id="settings-confirm-pw"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
              />
            </div>
            <button type="submit" className="settings-btn-primary" disabled={saving}>
              <KeyRound size={16} />
              <span>{saving ? 'Updating password...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="settings-grid" style={{ marginTop: 24 }}>
        <TrustedDevicesSection />

        {/* Account Session Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap icon-red">
              <ShieldAlert size={20} />
            </div>
            <h3>Account Session</h3>
          </div>
          <p className="settings-devices-hint">
            You are currently signed in as <strong>{email}</strong>. Logging out ends your active session and prevents unauthorized access.
          </p>
          <div className="settings-session-box">
            <div className="settings-profile-preview compact">
              <div className="settings-avatar-wrap">
                <div className="settings-avatar">{getInitials(displayNameFallback)}</div>
              </div>
              <div className="settings-profile-meta">
                <div className="settings-profile-name">{displayNameFallback}</div>
                <div className="settings-profile-email">
                  <Mail size={13} />
                  <span>{email}</span>
                </div>
                <span className={`role-pill ${role === 'Admin' ? 'pill-admin' : 'pill-member'}`}>
                  {role}
                </span>
              </div>
            </div>
            <div className="settings-session-actions">
              <button
                type="button"
                className="settings-signout-btn"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut size={16} />
                <span>{signingOut ? 'Signing out...' : 'Sign out of ReliefTrack'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
