import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getUserProfile,
  subscribeUsers,
  updateUserProfile,
  setUserStatus,
  deleteUserProfile,
  syncAuthUsersToFirestore,
  addUserAccount,
  updateUserLocation,
  INITIAL_AUTH_USERS,
} from '../firebase/users'
import { getBrowserLocation } from '../utils/getBrowserLocation'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/AdminDashboard.css'

const NAGA_BARANGAYS = [
  'Brgy. Central Poblacion, City of Naga, Cebu',
  'Brgy. North Poblacion, City of Naga, Cebu',
  'Brgy. South Poblacion, City of Naga, Cebu',
  'Brgy. Colon, City of Naga, Cebu',
  'Brgy. Tinaan, City of Naga, Cebu',
  'Brgy. Inoburan, City of Naga, Cebu',
  'Brgy. Mainit, City of Naga, Cebu',
  'Brgy. Pangdan, City of Naga, Cebu',
  'Brgy. Cantao-an, City of Naga, Cebu',
  'Brgy. Lutac, City of Naga, Cebu',
  'Brgy. Uling, City of Naga, Cebu',
  'Brgy. Tuyan, City of Naga, Cebu',
  'Brgy. Langtad, City of Naga, Cebu',
  'Brgy. Inayagan, City of Naga, Cebu',
  'Brgy. Balirong, City of Naga, Cebu',
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState(() =>
    INITIAL_AUTH_USERS.map((a) => ({
      docId: `user_${a.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      ...a,
    }))
  )
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')

  // Modals
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [holdTarget, setHoldTarget] = useState(null)
  const [isHolding, setIsHolding] = useState(false)

  // Location Sync & Edit Modal
  const [editLocationTarget, setEditLocationTarget] = useState(null)
  const [editLocationValue, setEditLocationValue] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [isDetectingLoc, setIsDetectingLoc] = useState(false)
  const [isLocSyncing, setIsLocSyncing] = useState(false)

  // Add User Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserData, setNewUserData] = useState({ name: '', email: '', location: '', role: 'Member', password: '' })
  const [isAddingUser, setIsAddingUser] = useState(false)

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const autoSyncedRef = useRef(false)

  // Feedback Toast
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Admin'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    const unsubUsers = subscribeUsers(
      (data) => {
        setUsers(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching users:', err)
        setLoading(false)
      }
    )
    return () => unsubUsers()
  }, [])

  // Auto-sync missing accounts from Firebase Auth on initial load
  useEffect(() => {
    if (!loading && !autoSyncedRef.current) {
      autoSyncedRef.current = true
      syncAuthUsersToFirestore(users)
        .then((addedCount) => {
          if (addedCount > 0) {
            showToast(`Synchronized ${addedCount} registered account${addedCount === 1 ? '' : 's'} from Firebase!`, 'success')
          }
        })
        .catch((err) => {
          console.error('Auto-sync error:', err)
        })
    }
  }, [loading, users])

  // Online Presence Helpers
  const isUserOnline = (u) => {
    // Current user is always online
    if (user?.uid && u.docId === user.uid) return true
    if (u.isOnline === false) return false
    if (!u.lastActiveAt) return false
    const ms = u.lastActiveAt?.toMillis
      ? u.lastActiveAt.toMillis()
      : (typeof u.lastActiveAt === 'number' ? u.lastActiveAt : new Date(u.lastActiveAt).getTime())
    if (isNaN(ms)) return false
    // Active within the last 3 minutes
    return Date.now() - ms < 3 * 60 * 1000
  }

  const formatLastSeen = (u) => {
    if (isUserOnline(u)) return 'Active now'
    if (!u.lastActiveAt) return 'Offline'
    const ms = u.lastActiveAt?.toMillis
      ? u.lastActiveAt.toMillis()
      : (typeof u.lastActiveAt === 'number' ? u.lastActiveAt : new Date(u.lastActiveAt).getTime())
    if (isNaN(ms)) return 'Offline'
    const diffSec = Math.floor((Date.now() - ms) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // User Management Summary Metrics
  const userStats = useMemo(() => {
    const total = users.length
    const online = users.filter((u) => isUserOnline(u)).length
    const onHold = users.filter((u) => u.status === 'On Hold').length
    const admins = users.filter((u) => u.role === 'Admin').length
    return { total, online, onHold, admins }
  }, [users, user?.uid])

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.location && u.location.toLowerCase().includes(q))

      const online = isUserOnline(u)
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Online' && online) ||
        (statusFilter === 'Offline' && !online) ||
        (statusFilter === 'Active' && u.status !== 'On Hold') ||
        (statusFilter === 'On Hold' && u.status === 'On Hold')

      const role = u.role === 'Admin' ? 'Admin' : 'Member'
      const matchesRole = roleFilter === 'All' || role === roleFilter

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, search, statusFilter, roleFilter, user?.uid])

  // Manual Sync Button
  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      const addedCount = await syncAuthUsersToFirestore(users)
      if (addedCount > 0) {
        showToast(`Synchronized ${addedCount} account${addedCount === 1 ? '' : 's'} from Firebase Authentication!`)
      } else {
        showToast('All registered accounts are already up-to-date.', 'info')
      }
    } catch (err) {
      console.error('Sync failed:', err)
      showToast('Failed to synchronize accounts.', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // Add User Form Submission
  const handleAddUserSubmit = async (e) => {
    e.preventDefault()
    if (!newUserData.email) return
    setIsAddingUser(true)
    try {
      const res = await addUserAccount(newUserData)
      showToast(
        res?.hasAuth
          ? `User account ${res.email} created with login credentials! Visible in User Management.`
          : `User account ${res?.email || newUserData.email} added and visible in User Management!`,
        'success'
      )
      setIsAddUserOpen(false)
      setNewUserData({ name: '', email: '', location: '', role: 'Member', password: '' })
    } catch (err) {
      console.error('Failed to add user account:', err)
      showToast(err?.message || 'Failed to add user account.', 'error')
    } finally {
      setIsAddingUser(false)
    }
  }

  // Toggle Role
  const toggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'Admin' ? 'Member' : 'Admin'
    try {
      await updateUserProfile(targetUser.docId, { role: newRole })
      showToast(`Role updated to ${newRole} for ${targetUser.displayName || targetUser.email}`)
    } catch (err) {
      console.error('Error updating role:', err)
      showToast('Failed to update user role.', 'error')
    }
  }

  // Hold / Unhold
  const promptHoldToggle = (targetUser) => {
    const isCurrentlyHold = targetUser.status === 'On Hold'
    setHoldTarget({
      ...targetUser,
      nextStatus: isCurrentlyHold ? 'Active' : 'On Hold',
    })
  }

  const confirmHoldToggle = async () => {
    if (!holdTarget) return
    setIsHolding(true)
    try {
      await setUserStatus(holdTarget.docId, holdTarget.nextStatus)
      showToast(
        holdTarget.nextStatus === 'On Hold'
          ? `Account for ${holdTarget.displayName || holdTarget.email} has been placed ON HOLD.`
          : `Hold released for ${holdTarget.displayName || holdTarget.email}. Account is now Active.`
      )
      setHoldTarget(null)
    } catch (err) {
      console.error('Error changing hold status:', err)
      showToast('Failed to update account hold status.', 'error')
    } finally {
      setIsHolding(false)
    }
  }

  // Delete User
  const promptDelete = (targetUser) => {
    setDeleteTarget(targetUser)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteUserProfile(deleteTarget.docId)
      showToast(`User account ${deleteTarget.displayName || deleteTarget.email} deleted successfully.`)
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting user:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Sync Current Admin Location
  const handleSyncCurrentLocation = async () => {
    if (!user?.uid) return
    setIsLocSyncing(true)
    try {
      const loc = await getBrowserLocation()
      if (loc) {
        await updateUserLocation(user.uid, loc)
        showToast(`📍 Your location updated: ${loc}`)
      } else {
        showToast('Could not detect device location. Please enable location permissions.', 'warning')
      }
    } catch (err) {
      console.error('Location sync error:', err)
      showToast('Failed to detect device location.', 'error')
    } finally {
      setIsLocSyncing(false)
    }
  }

  // Open Edit Location Modal for any user
  const openEditLocation = (targetUser) => {
    setEditLocationTarget(targetUser)
    setEditLocationValue(targetUser.location || '')
  }

  // Save updated location for target user
  const handleSaveLocation = async (e) => {
    e.preventDefault()
    if (!editLocationTarget) return
    setIsSavingLocation(true)
    try {
      await updateUserLocation(editLocationTarget.docId, editLocationValue)
      showToast(`Location updated for ${editLocationTarget.displayName || editLocationTarget.email}!`)
      setEditLocationTarget(null)
    } catch (err) {
      console.error('Error updating location:', err)
      showToast('Failed to update location.', 'error')
    } finally {
      setIsSavingLocation(false)
    }
  }

  // Detect location for modal input
  const handleDetectForTarget = async () => {
    setIsDetectingLoc(true)
    try {
      const loc = await getBrowserLocation()
      if (loc) {
        setEditLocationValue(loc)
        showToast(`Detected location: ${loc}`)
      } else {
        showToast('Could not detect device location. Please enable location permissions.', 'warning')
      }
    } catch {
      showToast('Location detection failed.', 'error')
    } finally {
      setIsDetectingLoc(false)
    }
  }

  const getInitials = (name, mail) => {
    const val = name?.trim() || mail?.split('@')[0] || 'U'
    const parts = val.split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return val.slice(0, 2).toUpperCase()
  }

  const formatUserDate = (createdAt) => {
    if (!createdAt) return '—'
    try {
      const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <DashboardLayout title="User Management" userLabel={displayName} userEmail={email}>
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="admin-header">
        <div className="admin-header-text">
          <h2>User Management</h2>
          <p>System overview of all registered accounts, account hold controls, and permissions.</p>
        </div>
      </div>

      {/* User Management Metrics */}
      <div className="admin-stats user-stats-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-icon">👥</span>
          <div className="admin-stat-value">{loading ? '—' : userStats.total}</div>
          <div className="admin-stat-label">Total Accounts</div>
        </div>
        <div className="admin-stat-card stat-online">
          <span className="admin-stat-icon">🟢</span>
          <div className="admin-stat-value text-online">{loading ? '—' : userStats.online}</div>
          <div className="admin-stat-label">Online Now</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">⏸️</span>
          <div className="admin-stat-value">{loading ? '—' : userStats.onHold}</div>
          <div className="admin-stat-label">On Hold</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🛡️</span>
          <div className="admin-stat-value">{loading ? '—' : userStats.admins}</div>
          <div className="admin-stat-label">Administrators</div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h3>All Registered Accounts</h3>
            <p className="admin-section-subtitle">
              {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'} displayed • {userStats.online} online
            </p>
          </div>

          <div className="admin-controls-bar">
            {/* Action Buttons */}
            <div className="admin-actions-group">
              <button
                type="button"
                className="admin-btn-sync"
                onClick={handleSyncCurrentLocation}
                disabled={isLocSyncing}
                title="Detect and sync your real live location to your profile"
              >
                {isLocSyncing ? '📍 Detecting...' : '📍 Sync Location'}
              </button>
              <button
                type="button"
                className="admin-btn-sync"
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Synchronize accounts from Firebase Authentication"
              >
                {isSyncing ? '⏳ Syncing...' : '🔄 Sync Accounts'}
              </button>
              <button
                type="button"
                className="admin-btn-add-user"
                onClick={() => setIsAddUserOpen(true)}
                title="Register a new user account"
              >
                ➕ Add Account
              </button>
            </div>

            <div className="admin-search-wrap">
              <span className="admin-search-icon">🔍</span>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search by name, email, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="admin-search-clear"
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="admin-filters-group">
              <select
                className="admin-select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Online">🟢 Online Now</option>
                <option value="Offline">⚪ Offline</option>
                <option value="Active">Active Status</option>
                <option value="On Hold">On Hold</option>
              </select>

              <select
                className="admin-select-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
              </select>
            </div>
          </div>
        </div>

        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Loading user accounts...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-empty">
              <p>No user accounts found matching your filters.</p>
              {(search || statusFilter !== 'All' || roleFilter !== 'All') && (
                <button
                  type="button"
                  className="admin-role-btn"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('All')
                    setRoleFilter('All')
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <table className="dashboard-table admin-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Presence</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isCurrentUser = user?.uid === u.docId
                  const isHold = u.status === 'On Hold'
                  const online = isUserOnline(u)

                  return (
                    <tr key={u.docId || u.email} className={`${isHold ? 'row-on-hold' : ''} ${online ? 'row-online' : ''}`}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar-wrap">
                            <div className={`admin-user-avatar ${u.role === 'Admin' ? 'avatar-admin' : ''}`}>
                              {getInitials(u.displayName, u.email)}
                            </div>
                            <span
                              className={`admin-avatar-dot ${online ? 'online' : 'offline'}`}
                              title={online ? 'Online now' : `Offline (${formatLastSeen(u)})`}
                            />
                          </div>
                          <div>
                            <span className="admin-user-name">
                              {u.displayName || 'No name set'}
                            </span>
                            {isCurrentUser && <span className="admin-current-user-tag">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="admin-user-email">
                        <a href={`mailto:${u.email}`} className="admin-email-link">
                          {u.email || '—'}
                        </a>
                      </td>
                      <td className="admin-user-location">
                        <button
                          type="button"
                          className="admin-location-pill"
                          onClick={() => openEditLocation(u)}
                          title="Click to edit or sync this user's location"
                        >
                          <span className="admin-location-icon">📍</span>
                          <span className="admin-location-pill-text">
                            {u.location || 'Set Location'}
                          </span>
                          <span className="admin-location-edit-icon">✏️</span>
                        </button>
                      </td>
                      <td>
                        <span className={`admin-role-badge ${u.role === 'Admin' ? 'admin' : 'member'}`}>
                          {u.role || 'Member'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-status-badge ${isHold ? 'badge-hold' : 'badge-active'}`}>
                          {isHold ? '⏸ On Hold' : '● Active'}
                        </span>
                      </td>
                      <td>
                        {online ? (
                          <span className="admin-presence-badge online" title="Currently active on ReliefTrack">
                            <span className="presence-pulse-dot" />
                            Online
                          </span>
                        ) : (
                          <span className="admin-presence-badge offline" title={`Last active: ${formatLastSeen(u)}`}>
                            <span className="presence-offline-dot" />
                            {formatLastSeen(u)}
                          </span>
                        )}
                      </td>
                      <td className="admin-user-date">
                        {formatUserDate(u.createdAt)}
                      </td>
                      <td>
                        <div className="admin-actions-cell">
                          {isCurrentUser ? (
                            <span className="admin-you-badge">Current Admin</span>
                          ) : (
                            <>
                              {/* Toggle Role */}
                              <button
                                type="button"
                                className="admin-role-btn"
                                onClick={() => toggleRole(u)}
                                title={`Change role to ${u.role === 'Admin' ? 'Member' : 'Admin'}`}
                              >
                                Make {u.role === 'Admin' ? 'Member' : 'Admin'}
                              </button>

                              {/* Hold / Unhold Button */}
                              <button
                                type="button"
                                className={`admin-action-btn-status ${isHold ? 'btn-unhold' : 'btn-hold'}`}
                                onClick={() => promptHoldToggle(u)}
                                title={isHold ? 'Release account hold' : 'Place account on hold'}
                              >
                                {isHold ? '▶ Unhold' : '⏸ Hold'}
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                className="admin-action-btn-delete"
                                onClick={() => promptDelete(u)}
                                title="Delete user account"
                              >
                                🗑 Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="admin-modal-overlay" onClick={() => !isAddingUser && setIsAddUserOpen(false)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header primary">
              <span className="admin-modal-icon">👤</span>
              <h4>Add User Account</h4>
            </div>
            <form onSubmit={handleAddUserSubmit}>
              <div className="admin-modal-body">
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  Register or track an account in the ReliefTrack User Management dashboard.
                </p>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="admin-form-input"
                    placeholder="user@example.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Maria Santos"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Location</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Naga, Camarines Sur"
                    value={newUserData.location}
                    onChange={(e) => setNewUserData({ ...newUserData, location: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    className="admin-form-input"
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Login Password (Optional)</label>
                  <input
                    type="password"
                    className="admin-form-input"
                    placeholder="Min. 6 characters (creates login credentials)"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  />
                  <small style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', display: 'block' }}>
                    Optional. If entered, creates credentials so the user can immediately sign in.
                  </small>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-modal-btn cancel"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={isAddingUser}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-modal-btn confirm"
                  disabled={isAddingUser}
                >
                  {isAddingUser ? 'Adding...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="admin-modal-overlay" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header danger">
              <span className="admin-modal-icon">🗑️</span>
              <h4>Delete User Account</h4>
            </div>
            <div className="admin-modal-body">
              <p>
                Are you sure you want to permanently delete the account for{' '}
                <strong>{deleteTarget.displayName || deleteTarget.email}</strong>?
              </p>
              <div className="admin-modal-warning-box">
                <p>⚠️ <strong>Warning:</strong></p>
                <p>
                  This action cannot be undone. All profile data associated with{' '}
                  <code>{deleteTarget.email}</code> will be removed from the system.
                </p>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-btn delete"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold / Unhold Confirmation Modal */}
      {holdTarget && (
        <div className="admin-modal-overlay" onClick={() => !isHolding && setHoldTarget(null)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className={`admin-modal-header ${holdTarget.nextStatus === 'On Hold' ? 'warning' : 'primary'}`}>
              <span className="admin-modal-icon">
                {holdTarget.nextStatus === 'On Hold' ? '⏸️' : '▶️'}
              </span>
              <h4>
                {holdTarget.nextStatus === 'On Hold' ? 'Place Account On Hold' : 'Release Account Hold'}
              </h4>
            </div>
            <div className="admin-modal-body">
              <p>
                {holdTarget.nextStatus === 'On Hold'
                  ? `Are you sure you want to put ${holdTarget.displayName || holdTarget.email} on hold?`
                  : `Are you sure you want to reactivate the account for ${holdTarget.displayName || holdTarget.email}?`}
              </p>
              <div className={`admin-modal-info-box ${holdTarget.nextStatus === 'On Hold' ? 'hold' : 'active'}`}>
                {holdTarget.nextStatus === 'On Hold' ? (
                  <p>
                    While on hold, the user will be restricted from accessing relief operations, creating requests, and logging in.
                  </p>
                ) : (
                  <p>
                    Releasing the hold will restore normal access immediately for this user.
                  </p>
                )}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-modal-btn cancel"
                onClick={() => setHoldTarget(null)}
                disabled={isHolding}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`admin-modal-btn ${holdTarget.nextStatus === 'On Hold' ? 'hold' : 'confirm'}`}
                onClick={confirmHoldToggle}
                disabled={isHolding}
              >
                {isHolding
                  ? 'Updating...'
                  : holdTarget.nextStatus === 'On Hold'
                  ? 'Confirm Hold'
                  : 'Reactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Location Modal */}
      {editLocationTarget && (
        <div className="admin-modal-overlay" onClick={() => !isSavingLocation && setEditLocationTarget(null)}>
          <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header primary">
              <span className="admin-modal-icon">📍</span>
              <h4>Sync User Location</h4>
            </div>
            <form onSubmit={handleSaveLocation}>
              <div className="admin-modal-body">
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  Updating location for <strong>{editLocationTarget.displayName || editLocationTarget.email}</strong>.
                </p>

                <div className="admin-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="admin-form-label" style={{ margin: 0 }}>Location / Address</label>
                    <button
                      type="button"
                      className="admin-quick-loc-btn"
                      onClick={handleDetectForTarget}
                      disabled={isDetectingLoc}
                      title="Detect current device coordinates and fill address"
                    >
                      {isDetectingLoc ? '📍 Detecting...' : '📍 Detect Device Location'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    placeholder="e.g. Brgy. Central Poblacion, City of Naga, Cebu"
                    value={editLocationValue}
                    onChange={(e) => setEditLocationValue(e.target.value)}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                    Quick Select Naga City Barangay:
                  </label>
                  <div className="admin-barangay-chips">
                    {NAGA_BARANGAYS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`admin-barangay-chip ${editLocationValue === b ? 'selected' : ''}`}
                        onClick={() => setEditLocationValue(b)}
                      >
                        {b.replace(', City of Naga, Cebu', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-modal-btn cancel"
                  onClick={() => setEditLocationTarget(null)}
                  disabled={isSavingLocation}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-modal-btn confirm"
                  disabled={isSavingLocation}
                >
                  {isSavingLocation ? 'Saving...' : 'Save & Sync Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
