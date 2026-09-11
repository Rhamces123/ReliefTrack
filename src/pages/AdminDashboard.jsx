import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getUserProfile,
  subscribeUsers,
  updateUserProfile,
  setUserStatus,
  deleteUserProfile,
} from '../firebase/users'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/AdminDashboard.css'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
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

  // User Management Summary Metrics
  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status !== 'On Hold').length
    const onHold = users.filter((u) => u.status === 'On Hold').length
    const admins = users.filter((u) => u.role === 'Admin').length
    return { total, active, onHold, admins }
  }, [users])

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.location && u.location.toLowerCase().includes(q))

      const status = u.status === 'On Hold' ? 'On Hold' : 'Active'
      const matchesStatus = statusFilter === 'All' || status === statusFilter

      const role = u.role === 'Admin' ? 'Admin' : 'Member'
      const matchesRole = roleFilter === 'All' || role === roleFilter

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, search, statusFilter, roleFilter])

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
      showToast('Failed to delete user account.', 'error')
    } finally {
      setIsDeleting(false)
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
        <div className="admin-stat-card">
          <span className="admin-stat-icon">🟢</span>
          <div className="admin-stat-value">{loading ? '—' : userStats.active}</div>
          <div className="admin-stat-label">Active Users</div>
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
              {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'} displayed
            </p>
          </div>

          <div className="admin-controls-bar">
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
                <option value="Active">Active</option>
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
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isCurrentUser = user?.uid === u.docId
                  const isHold = u.status === 'On Hold'

                  return (
                    <tr key={u.docId || u.email} className={isHold ? 'row-on-hold' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <div className={`admin-user-avatar ${u.role === 'Admin' ? 'avatar-admin' : ''}`}>
                            {getInitials(u.displayName, u.email)}
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
                      <td className="admin-user-location" title={u.location || ''}>
                        {u.location ? (
                          <span>📍 {u.location}</span>
                        ) : (
                          <span className="admin-dim-text">Not specified</span>
                        )}
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
    </DashboardLayout>
  )
}
