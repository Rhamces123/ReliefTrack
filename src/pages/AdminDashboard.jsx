import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile, subscribeUsers, updateUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import { subscribeInventoryItems } from '../firebase/inventory'
import { countByStatus } from '../utils/requestHelpers'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/AdminDashboard.css'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Admin'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    const unsubUsers = subscribeUsers(
      (data) => { setUsers(data); setLoading(false) },
      () => setLoading(false)
    )
    const unsubRequests = subscribeReliefRequests(
      (data) => setRequests(data),
      () => {},
      { uid: user.uid, role: profile?.role }
    )
    const unsubInventory = subscribeInventoryItems(
      (data) => setItems(data),
      () => {}
    )
    return () => { unsubUsers(); unsubRequests(); unsubInventory() }
  }, [user?.uid, profile?.role])

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalRequests: requests.length,
    totalItems: items.length,
    pendingRequests: countByStatus(requests).pending || 0,
    completedRequests: countByStatus(requests).completed || 0,
    totalQuantity: items.reduce((s, i) => s + (i.quantity || 0), 0),
  }), [users, requests, items])

  const toggleRole = async (uid, currentRole) => {
    const newRole = currentRole === 'Admin' ? 'Member' : 'Admin'
    await updateUserProfile(uid, { role: newRole })
  }

  return (
    <DashboardLayout title="Admin Dashboard" userLabel={displayName} userEmail={email}>
      <div className="admin-header">
        <div className="admin-header-text">
          <h2>Admin Dashboard</h2>
          <p>System overview and user management.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-icon">👥</span>
          <div className="admin-stat-value">{loading ? '—' : stats.totalUsers}</div>
          <div className="admin-stat-label">Total Users</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">📋</span>
          <div className="admin-stat-value">{loading ? '—' : stats.totalRequests}</div>
          <div className="admin-stat-label">Total Requests</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">📦</span>
          <div className="admin-stat-value">{loading ? '—' : stats.totalItems}</div>
          <div className="admin-stat-label">Inventory Items</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">⏳</span>
          <div className="admin-stat-value">{loading ? '—' : stats.pendingRequests}</div>
          <div className="admin-stat-label">Pending Requests</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">✅</span>
          <div className="admin-stat-value">{loading ? '—' : stats.completedRequests}</div>
          <div className="admin-stat-label">Completed</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-icon">📊</span>
          <div className="admin-stat-value">{loading ? '—' : stats.totalQuantity}</div>
          <div className="admin-stat-label">Total Quantity</div>
        </div>
      </div>

      <div className="admin-quick-actions">
        <button className="admin-action-btn" onClick={() => navigate('/admin/auto-suggest')}>
          <span>💡</span> Auto Suggest
        </button>
        <button className="admin-action-btn" onClick={() => navigate('/reports')}>
          <span>📊</span> View Reports
        </button>
        <button className="admin-action-btn" onClick={() => navigate('/requests')}>
          <span>📋</span> Manage Requests
        </button>
        <button className="admin-action-btn" onClick={() => navigate('/inventory')}>
          <span>📦</span> Manage Inventory
        </button>
        <button className="admin-action-btn" onClick={() => navigate('/settings')}>
          <span>⚙️</span> Settings
        </button>
      </div>

      <div className="admin-section">
        <h3>User Management</h3>
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="admin-empty">No users found.</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.docId || u.email}>
                    <td><span className="admin-user-name">{u.displayName || '—'}</span></td>
                    <td className="admin-user-email">{u.email || '—'}</td>
                    <td>{u.location || '—'}</td>
                    <td>
                      <span className={`admin-role-badge ${u.role === 'Admin' ? 'admin' : 'member'}`}>
                        {u.role || 'Member'}
                      </span>
                    </td>
                    <td>
                      {user?.uid !== u.docId && (
                        <button
                          type="button"
                          className="admin-role-btn"
                          onClick={() => toggleRole(u.docId, u.role)}
                        >
                          Make {u.role === 'Admin' ? 'Member' : 'Admin'}
                        </button>
                      )}
                      {user?.uid === u.docId && (
                        <span className="admin-you-badge">You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
