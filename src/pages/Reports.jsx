import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import { subscribeInventoryItems } from '../firebase/inventory'
import { countByStatus } from '../utils/requestHelpers'
import { countByCategory, countLowStock, getCategoryLabel } from '../utils/inventoryHelpers'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Reports.css'

export default function Reports() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user])

  useEffect(() => {
    const unsubRequests = subscribeReliefRequests(
      (data) => { setRequests(data); setLoading(false); setError('') },
      (err) => { setError(err.message || 'Failed to load requests.'); setLoading(false) },
      { uid: user.uid, role: profile?.role }
    )
    const unsubInventory = subscribeInventoryItems(
      (data) => { setItems(data) },
      () => {}
    )
    return () => { unsubRequests(); unsubInventory() }
  }, [user?.uid, profile?.role])

  const statusCounts = countByStatus(requests)
  const totalRequests = requests.length
  const totalItems = items.length
  const lowStockCount = countLowStock(items)
  const totalQuantity = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
  const categoryCounts = countByCategory(items)
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
  const recentActivity = [...requests]
    .sort((a, b) => {
      const da = a.createdAt?.getTime?.() || 0
      const db = b.createdAt?.getTime?.() || 0
      return db - da
    })
    .slice(0, 6)

  const OVERVIEW_STATS = [
    { label: 'Total Requests', value: totalRequests, icon: '📋' },
    { label: 'Total Items', value: totalItems, icon: '📦' },
    { label: 'Total Quantity', value: totalQuantity, icon: '📊' },
    { label: 'Low Stock Items', value: lowStockCount, icon: '⚠️', warn: lowStockCount > 0 },
  ]

  const STATUS_CONFIG = [
    { key: 'pending', label: 'Pending', color: '#fcd34d', bg: 'rgba(255,180,50,0.2)' },
    { key: 'in-progress', label: 'In Progress', color: '#c4b5fd', bg: 'rgba(120,80,255,0.25)' },
    { key: 'completed', label: 'Completed', color: '#6ee7b7', bg: 'rgba(0,200,150,0.2)' },
  ]

  return (
    <DashboardLayout title="Reports" userLabel={displayName} userEmail={email}>
      <div className="reports-header">
        <div className="reports-header-text">
          <h2>Reports</h2>
          <p>Overview of relief operations and inventory status.</p>
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}

      <div className="reports-stats">
        {OVERVIEW_STATS.map((s) => (
          <div key={s.label} className={`reports-stat-card${s.warn ? ' warn' : ''}`}>
            <div className="reports-stat-icon">{s.icon}</div>
            <div className="reports-stat-value">
              {loading && !error ? '—' : s.value}
            </div>
            <div className="reports-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="reports-grid">
        <div className="reports-card">
          <h3>Requests by Status</h3>
          {loading && !error ? (
            <p className="reports-empty">Loading...</p>
          ) : totalRequests === 0 ? (
            <p className="reports-empty">No requests yet.</p>
          ) : (
            <div className="reports-bar-group">
              {STATUS_CONFIG.map(({ key, label, color }) => {
                const count = statusCounts[key] || 0
                const pct = totalRequests > 0 ? (count / totalRequests) * 100 : 0
                return (
                  <div key={key} className="reports-bar-row">
                    <div className="reports-bar-label">
                      <span>{label}</span>
                      <span>{count}</span>
                    </div>
                    <div className="reports-bar-track">
                      <div
                        className="reports-bar-fill"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="reports-card">
          <h3>Inventory by Category</h3>
          {loading && !error ? (
            <p className="reports-empty">Loading...</p>
          ) : totalItems === 0 ? (
            <p className="reports-empty">No inventory items yet.</p>
          ) : (
            <div className="reports-bar-group">
              {categories.map(([cat, count]) => {
                const pct = totalItems > 0 ? (count / totalItems) * 100 : 0
                return (
                  <div key={cat} className="reports-bar-row">
                    <div className="reports-bar-label">
                      <span>{getCategoryLabel(cat)}</span>
                      <span>{count}</span>
                    </div>
                    <div className="reports-bar-track">
                      <div
                        className="reports-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="reports-card">
        <h3>Recent Activity</h3>
        {loading && !error ? (
          <p className="reports-empty">Loading...</p>
        ) : recentActivity.length === 0 ? (
          <p className="reports-empty">No recent activity.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Location / Name</th>
                <th>Status / Category</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr key={row.docId}>
                  <td>{row.requestId}</td>
                  <td>Request</td>
                  <td>{row.location}</td>
                  <td>
                    <span className={`dashboard-status ${row.status}`}>
                      {row.status === 'in-progress' ? 'In Progress' : row.status?.charAt(0).toUpperCase() + row.status?.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  )
}
