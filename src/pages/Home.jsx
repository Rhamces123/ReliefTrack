import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Requests.css'
import {
  formatRequestDate,
  getStatusLabel,
  getStatusClass,
  countByStatus,
} from '../utils/requestHelpers'

const QUICK_ACTIONS = [
  { label: 'New Relief Request', icon: '➕', action: 'newRequest' },
  { label: 'View Map', icon: '🗺️', action: 'soon' },
  { label: 'Add Donation', icon: '🎁', action: 'soon' },
  { label: 'Generate Report', icon: '📄', action: 'soon' },
]

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid)
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    const unsubscribe = subscribeReliefRequests(
      (data) => {
        setRequests(data)
        setLoading(false)
        setError('')
      },
      (err) => {
        setError(err.message || 'Failed to load relief requests from Firestore.')
        setLoading(false)
      },
      { uid: user.uid, role: profile?.role }
    )
    return unsubscribe
  }, [user?.uid, profile?.role])

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''
  const role = profile?.role || 'Member'

  const counts = countByStatus(requests)
  const activeCount = counts['in-progress'] || 0
  const pendingCount = counts.pending || 0
  const completedCount = counts.completed || 0

  const STATS = [
    { label: 'Active Requests', value: activeCount, icon: '📋' },
    { label: 'Pending Approvals', value: pendingCount, icon: '⏳' },
    { label: 'Completed', value: completedCount, icon: '✅' },
    { label: 'Total Requests', value: requests.length, icon: '📊' },
  ]

  const recentRequests = requests.slice(0, 5)

  const handleQuickAction = (action) => {
    if (action === 'newRequest') {
      navigate('/requests', { state: { openForm: true } })
      return
    }
    setToast('This feature is coming soon.')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <DashboardLayout title="Dashboard" userLabel={displayName} userEmail={email}>
      {toast && <div className="dashboard-toast">{toast}</div>}
      {error && <div className="requests-error">{error}</div>}

      <div className="dashboard-header-row">
        <div className="dashboard-welcome">
          <h2>Welcome back, {displayName}</h2>
          <p>Monitor relief operations and coordinate aid across your community.</p>
        </div>
        <div className="dashboard-profile-card">
          <div className="dashboard-avatar">{getInitials(displayName)}</div>
          <div className="dashboard-profile-info">
            <div className="name">{displayName}</div>
            <div className="email">{email}</div>
            {role && <div className="role">{role}</div>}
          </div>
        </div>
      </div>

      <div className="dashboard-stats">
        {STATS.map((stat) => (
          <div key={stat.label} className="dashboard-stat-card">
            <div className="dashboard-stat-icon">{stat.icon}</div>
            <div className="dashboard-stat-value">
              {loading && !error ? '—' : stat.value}
            </div>
            <div className="dashboard-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <h3 className="dashboard-section-title">Quick actions</h3>
      <div className="dashboard-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="dashboard-action-btn"
            onClick={() => handleQuickAction(action.action)}
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      <h3 className="dashboard-section-title">Recent relief requests</h3>
      <div className="dashboard-activity">
        {loading && !error ? (
          <p className="dashboard-empty">Loading requests...</p>
        ) : error ? (
          <p className="dashboard-empty">
            Unable to load requests. Check Firestore rules and try again.
          </p>
        ) : recentRequests.length > 0 ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Location</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((row) => (
                <tr key={row.docId}>
                  <td>{row.requestId}</td>
                  <td>{row.location}</td>
                  <td>
                    <span className={`dashboard-status ${getStatusClass(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{formatRequestDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dashboard-empty">
            No relief requests yet.{' '}
            <button
              type="button"
              className="requests-btn-primary"
              style={{ marginTop: 12, display: 'inline-block' }}
              onClick={() => navigate('/requests', { state: { openForm: true } })}
            >
              Create first request
            </button>
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
