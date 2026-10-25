import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import { subscribeInventoryItems } from '../firebase/inventory'
import { countByStatus } from '../utils/requestHelpers'
import { countByCategory, countLowStock, getCategoryLabel } from '../utils/inventoryHelpers'
import DashboardLayout from '../components/DashboardLayout'
import GenerateReportModal from '../components/GenerateReportModal'
import PieChart from '../components/PieChart'
import '../styles/Reports.css'
import {
  ClipboardList,
  Package,
  Layers,
  AlertTriangle,
  FileText,
} from 'lucide-react'

const CATEGORY_COLORS = {
  food: '#1674D1',
  water: '#0284C7',
  medical: '#DC2626',
  shelter: '#8B5CF6',
  hygiene: '#14B8A6',
  clothing: '#F59E0B',
  other: '#64748B',
}

export default function Reports() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)

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

  const statusCounts = useMemo(() => countByStatus(requests), [requests])
  const totalRequests = requests.length
  const totalItems = items.length
  const lowStockCount = useMemo(() => countLowStock(items), [items])
  const totalQuantity = useMemo(() => items.reduce((sum, i) => sum + (i.quantity || 0), 0), [items])
  const categoryCounts = useMemo(() => countByCategory(items), [items])
  const categories = useMemo(() => Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]), [categoryCounts])
  
  const recentActivity = useMemo(() => {
    return [...requests]
      .sort((a, b) => {
        const da = a.createdAt?.getTime?.() || 0
        const db = b.createdAt?.getTime?.() || 0
        return db - da
      })
      .slice(0, 6)
  }, [requests])

  const OVERVIEW_STATS = [
    { label: 'Total Requests', value: totalRequests, icon: ClipboardList, color: '#1674D1', bg: '#EFF6FF' },
    { label: 'Total Items', value: totalItems, icon: Package, color: '#123B66', bg: '#F1F5F9' },
    { label: 'Total Quantity', value: totalQuantity, icon: Layers, color: '#39A935', bg: '#F0FDF4' },
    { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: lowStockCount > 0 ? '#DC2626' : '#64748B', bg: lowStockCount > 0 ? '#FEF2F2' : '#F8FAFC', warn: lowStockCount > 0 },
  ]

  const requestChartData = useMemo(() => [
    { label: 'Pending', value: statusCounts.pending || 0, color: '#F59E0B' },
    { label: 'In Progress', value: statusCounts['in-progress'] || 0, color: '#1674D1' },
    { label: 'Completed', value: statusCounts.completed || 0, color: '#39A935' },
    { label: 'Rejected', value: statusCounts.rejected || 0, color: '#DC2626' },
  ], [statusCounts])

  const inventoryChartData = useMemo(() => {
    return categories.map(([cat, count]) => ({
      label: getCategoryLabel(cat),
      value: count,
      color: CATEGORY_COLORS[cat] || '#64748B',
    }))
  }, [categories])

  return (
    <DashboardLayout title="Reports" userLabel={displayName} userEmail={email}>
      <div className="reports-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div className="reports-header-text">
          <h2>Reports & Analytics</h2>
          <p>Overview of relief operations, requests distribution, and inventory status.</p>
        </div>
        <button
          type="button"
          className="requests-btn-primary"
          onClick={() => setShowReportModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} /> Generate Report
        </button>
      </div>

      {error && <div className="requests-error">{error}</div>}

      <div className="reports-stats">
        {OVERVIEW_STATS.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`reports-stat-card${s.warn ? ' warn' : ''}`}>
              <div
                className="reports-stat-icon-wrap"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: s.bg,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <Icon size={20} />
              </div>
              <div className="reports-stat-value">
                {loading && !error ? '—' : s.value}
              </div>
              <div className="reports-stat-label">{s.label}</div>
            </div>
          )
        })}
      </div>

      <div className="reports-grid">
        <PieChart
          title="Requests by Status"
          subtitle="Real-time distribution of community relief requests"
          data={requestChartData}
          totalLabel="Requests"
          loading={loading && !error}
          emptyMessage="No relief requests recorded yet."
        />

        <PieChart
          title="Inventory by Category"
          subtitle="Available relief stock categorized by supplies"
          data={inventoryChartData}
          totalLabel="Categories"
          loading={loading && !error}
          emptyMessage="No inventory items recorded yet."
        />
      </div>

      <div className="reports-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#123B66' }}>Recent Activity</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Latest logged relief requests and changes</p>
          </div>
        </div>
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr key={row.docId}>
                  <td style={{ fontWeight: 600, color: '#1674D1' }}>{row.requestId}</td>
                  <td>Relief Request</td>
                  <td>{row.location || 'City of Naga'}</td>
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

      <GenerateReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        initialRequests={requests}
        initialItems={items}
        user={user}
        profile={profile}
      />
    </DashboardLayout>
  )
}
