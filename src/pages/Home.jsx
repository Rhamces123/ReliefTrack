import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import GenerateReportModal from '../components/GenerateReportModal'
import PieChart from '../components/PieChart'
import {
  formatRequestDate,
  getStatusLabel,
  getStatusClass,
  countByStatus,
} from '../utils/requestHelpers'
import {
  Files,
  Hourglass,
  CircleCheck,
  ShieldCheck,
  Plus,
  Siren,
  Bell,
  Eye,
  MapPin,
  Calendar,
  Users,
  AlertTriangle,
  X,
  ExternalLink,
  Phone,
  Info,
  Clock,
  ArrowRight,
  ClipboardList,
  Search,
} from 'lucide-react'

export default function Home() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast] = useState('')

  // Modals & Popups
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin =
    (adminEmail && user?.email?.toLowerCase() === adminEmail.toLowerCase()) ||
    userProfile?.role === 'Admin' ||
    profile?.role === 'Admin'

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
    // Subscribe to requests: regular user gets only their own, admin gets all
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
      { uid: user?.uid, role: profile?.role }
    )
    return unsubscribe
  }, [user?.uid, profile?.role])

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Community Member'
  const email = profile?.email || user?.email || ''

  // Metric calculation
  const counts = countByStatus(requests)
  const pendingCount = counts.pending || 0
  const inProgressCount = counts['in-progress'] || 0
  const completedCount = counts.completed || 0
  const totalCount = requests.length

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchFilter.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (r.requestId && r.requestId.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))

      const matchesStatus =
        statusFilter === 'all' || r.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [requests, searchFilter, statusFilter])

  const recentRequests = filteredRequests.slice(0, 6)

  const handleQuickAction = (action) => {
    if (action === 'newRequest') {
      navigate('/requests', { state: { openForm: true } })
      return
    }
    if (action === 'viewAlerts') {
      setShowAlertModal(true)
      return
    }
    if (action === 'generateReport') {
      setShowReportModal(true)
      return
    }
  }


  return (
    <DashboardLayout title="Dashboard" userLabel={displayName} userEmail={email}>
      {toast && <div className="dashboard-toast">{toast}</div>}
      {error && <div className="requests-error">{error}</div>}

      {/* Admin Switch Banner */}
      {isAdmin && (
        <div className="admin-switch-banner">
          <div className="admin-switch-text">
            <ShieldCheck size={20} className="text-bright-blue" />
            <span>
              You are signed in as an <strong>Administrator</strong>. You can access operational dispatch, inventory, and analytics in the Admin Dashboard.
            </span>
          </div>
          <button
            type="button"
            className="admin-switch-btn"
            onClick={() => navigate('/admin')}
          >
            Open Admin Dashboard
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* User Dashboard Welcome Header */}
      <div className="dashboard-welcome-header">
        <div className="dashboard-welcome-main">
          <h2 className="welcome-title">Welcome back, {displayName}</h2>
          <p className="welcome-subtitle">
            Track your relief requests and stay informed about your community in the City of Naga, Cebu.
          </p>
        </div>
        <div className="dashboard-quick-submit-cta">
          <button
            type="button"
            className="btn-primary-large"
            onClick={() => handleQuickAction('newRequest')}
          >
            <Plus size={18} />
            <span>Submit Relief Request</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards (Real Data) */}
      <div className="dashboard-stats-grid">
        {/* Total Requests */}
        <div className="dashboard-stat-card card-total">
          <div className="stat-card-icon-wrap icon-blue">
            <Files size={24} />
          </div>
          <div className="stat-card-data">
            <div className="stat-card-value">{loading ? '—' : totalCount}</div>
            <div className="stat-card-label">My Total Requests</div>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="dashboard-stat-card card-pending">
          <div className="stat-card-icon-wrap icon-orange">
            <Hourglass size={24} />
          </div>
          <div className="stat-card-data">
            <div className="stat-card-value">{loading ? '—' : pendingCount}</div>
            <div className="stat-card-label">Pending Requests</div>
          </div>
        </div>

        {/* Approved / In Progress */}
        <div className="dashboard-stat-card card-inprogress">
          <div className="stat-card-icon-wrap icon-navy">
            <Clock size={24} />
          </div>
          <div className="stat-card-data">
            <div className="stat-card-value">{loading ? '—' : inProgressCount}</div>
            <div className="stat-card-label">Approved & In Progress</div>
          </div>
        </div>

        {/* Completed Requests */}
        <div className="dashboard-stat-card card-completed">
          <div className="stat-card-icon-wrap icon-green">
            <CircleCheck size={24} />
          </div>
          <div className="stat-card-data">
            <div className="stat-card-value">{loading ? '—' : completedCount}</div>
            <div className="stat-card-label">Completed Requests</div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="dashboard-section-header">
        <h3 className="dashboard-section-title">Quick Actions</h3>
        <span className="section-subtitle">Access emergency services and relief requests</span>
      </div>
      <div className="dashboard-quick-actions-grid">
        <button
          type="button"
          className="quick-action-card action-primary"
          onClick={() => handleQuickAction('newRequest')}
        >
          <div className="quick-action-icon bg-bright-blue">
            <Plus size={22} />
          </div>
          <div className="quick-action-meta">
            <div className="quick-action-title">Submit Relief Request</div>
            <div className="quick-action-desc">Request food packs, water, or medical aid</div>
          </div>
        </button>

        <button
          type="button"
          className="quick-action-card"
          onClick={() => navigate('/requests')}
        >
          <div className="quick-action-icon bg-navy">
            <ClipboardList size={22} />
          </div>
          <div className="quick-action-meta">
            <div className="quick-action-title">My Relief Requests</div>
            <div className="quick-action-desc">View status and tracking of your aid requests</div>
          </div>
        </button>

        <button
          type="button"
          className="quick-action-card"
          onClick={() => handleQuickAction('viewAlerts')}
        >
          <div className="quick-action-icon bg-orange">
            <Bell size={22} />
          </div>
          <div className="quick-action-meta">
            <div className="quick-action-title">Relief Alerts</div>
            <div className="quick-action-desc">Live relief operations updates across Naga City</div>
          </div>
        </button>
      </div>

      {/* Relief Operations Advisory Panel */}
      <div className="dashboard-panel alert-panel" style={{ marginBottom: '28px' }}>
        <div className="panel-header">
          <div className="panel-title-group">
            <Siren size={18} className="text-red" />
            <h4 className="panel-title">City of Naga Relief Operations Advisory</h4>
          </div>
          <span className="badge-advisory-live">
            <span className="live-pulse" /> Active Operations
          </span>
        </div>

        <div className="advisory-body">
          <div className="advisory-alert-box">
            <div className="advisory-icon">
              <AlertTriangle size={20} className="text-orange" />
            </div>
            <div className="advisory-text">
              <strong>Relief Operations In Progress:</strong> City Government of Naga relief teams are actively coordinating supply allocations and dispatching emergency aid kits to priority barangays.
            </div>
          </div>

          <div className="advisory-guidelines">
            <div className="guideline-item">
              <ShieldCheck size={16} className="text-green" />
              <span>
                <strong>Distribution Centers Open:</strong> Naga Central Elementary School & Tuyan National High School are operational for food packs and clean water distribution.
              </span>
            </div>
            <div className="guideline-item">
              <Info size={16} className="text-bright-blue" />
              <span>
                Barangay coordinators in Tinaan and Inoburan are currently processing household relief supply requests.
              </span>
            </div>
            <div className="guideline-item">
              <Phone size={16} className="text-navy" />
              <span>
                <strong>24/7 Naga Relief Operations Hotline:</strong> (032) 489-8988 / 0917-702-6242.
              </span>
            </div>
          </div>

          <div className="advisory-footer-actions">
            <button
              type="button"
              className="btn-outline-small"
              onClick={() => setShowAlertModal(true)}
            >
              View Relief Guidelines
            </button>
          </div>
        </div>
      </div>

      {/* Request Status Breakdown Pie Chart */}
      {requests.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <PieChart
            title="My Requests Status Breakdown"
            subtitle="Current status distribution of all your submitted relief requests"
            data={[
              { label: 'Pending', value: pendingCount, color: '#F59E0B' },
              { label: 'In Progress', value: inProgressCount, color: '#1674D1' },
              { label: 'Completed', value: completedCount, color: '#39A935' },
              { label: 'Rejected', value: counts.rejected || 0, color: '#DC2626' },
            ]}
            totalLabel="Requests"
          />
        </div>
      )}

      {/* My Recent Requests Section */}
      <div className="dashboard-recent-section">
        <div className="recent-section-header">
          <div className="recent-header-text">
            <h3 className="dashboard-section-title">My Recent Relief Requests</h3>
            <span className="section-subtitle">Real-time status updates of your submitted aid requests</span>
          </div>
          <div className="recent-section-actions">
            <div className="toolbar-search-box" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <Search size={14} className="search-icon" style={{ position: 'absolute', left: '10px', color: '#718096' }} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search my requests..."
                style={{ padding: '6px 24px 6px 30px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
              />
              {searchFilter && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchFilter('')}
                  style={{ position: 'absolute', right: '6px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
              style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <button
              type="button"
              className="btn-outline-small"
              onClick={() => navigate('/requests')}
            >
              View All ({requests.length})
            </button>
          </div>
        </div>

        <div className="dashboard-table-card">
          {loading && !error ? (
            <div className="dashboard-loading-state">
              <div className="loading-spinner" />
              <span>Loading your relief requests...</span>
            </div>
          ) : error ? (
            <div className="dashboard-empty-state">
              <AlertTriangle size={36} className="text-orange" />
              <p>{error}</p>
            </div>
          ) : recentRequests.length > 0 ? (
            <div className="table-responsive">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Relief Needs & Description</th>
                    <th>Location / Barangay</th>
                    <th>Date Submitted</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((row) => (
                    <tr key={row.docId}>
                      <td className="font-mono font-medium text-navy">
                        {row.requestId}
                      </td>
                      <td>
                        <div className="request-needs-cell">
                          <span className="request-desc-text">
                            {row.description || 'Emergency Relief Assistance'}
                          </span>
                          {row.familyMembers > 0 && (
                            <span className="request-family-tag">
                              <Users size={12} /> {row.familyMembers} members
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="request-loc-cell">
                          <MapPin size={14} className="text-bright-blue" />
                          <span>{row.location || 'City of Naga'}</span>
                        </div>
                      </td>
                      <td className="text-muted">
                        <div className="request-date-cell">
                          <Calendar size={14} />
                          <span>{formatRequestDate(row.createdAt)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(row.status)}`}>
                          {row.status === 'pending' && <Hourglass size={13} />}
                          {row.status === 'in-progress' && <Clock size={13} />}
                          {row.status === 'completed' && <CircleCheck size={13} />}
                          <span>{getStatusLabel(row.status)}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => setSelectedRequest(row)}
                          title="View Request Details"
                        >
                          <Eye size={16} />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <ClipboardList size={48} className="empty-icon" />
              <h4>No relief requests found</h4>
              <p>
                You haven't submitted any relief requests yet. If your household or community needs food, water, or medical supplies, submit a request now.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleQuickAction('newRequest')}
              >
                <Plus size={16} />
                <span>Submit Your First Request</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <ClipboardList size={20} className="text-bright-blue" />
                <h3>Request Details: {selectedRequest.requestId}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-status-row">
                <span className="detail-label">Current Status:</span>
                <span className={`status-badge ${getStatusClass(selectedRequest.status)}`}>
                  {getStatusLabel(selectedRequest.status)}
                </span>
                <span className="detail-date">
                  Submitted: {formatRequestDate(selectedRequest.createdAt)}
                </span>
              </div>

              <div className="detail-card">
                <div className="detail-field">
                  <span className="field-label">Location / Address</span>
                  <div className="field-value">
                    <MapPin size={16} className="text-bright-blue" />
                    <span>{selectedRequest.location || 'City of Naga, Cebu'}</span>
                  </div>
                </div>

                <div className="detail-field">
                  <span className="field-label">Requester Name</span>
                  <div className="field-value">
                    {selectedRequest.requesterName || selectedRequest.createdByName || displayName}
                  </div>
                </div>

                <div className="detail-field">
                  <span className="field-label">Family Members</span>
                  <div className="field-value">
                    {selectedRequest.familyMembers || 1} household members
                  </div>
                </div>

                <div className="detail-field full-width">
                  <span className="field-label">Assistance Details / Description</span>
                  <div className="field-value-box">
                    {selectedRequest.description || 'General relief goods, clean drinking water, and basic hygiene assistance.'}
                  </div>
                </div>

                {selectedRequest.categories && Object.keys(selectedRequest.categories).length > 0 && (
                  <div className="detail-field full-width">
                    <span className="field-label">Vulnerable Household Members</span>
                    <div className="detail-tags-list">
                      {selectedRequest.categories.pregnantWomen?.count > 0 && (
                        <span className="category-pill">
                          Pregnant: {selectedRequest.categories.pregnantWomen.count}
                        </span>
                      )}
                      {selectedRequest.categories.elders?.count > 0 && (
                        <span className="category-pill">
                          Elderly: {selectedRequest.categories.elders.count}
                        </span>
                      )}
                      {selectedRequest.categories.pwd?.count > 0 && (
                        <span className="category-pill">
                          PWD: {selectedRequest.categories.pwd.count}
                        </span>
                      )}
                      {selectedRequest.categories.childrenBelow7?.count > 0 && (
                        <span className="category-pill">
                          Children ≤ 7: {selectedRequest.categories.childrenBelow7.count}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSelectedRequest(null)
                  navigate('/requests')
                }}
              >
                Open in Requests Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relief Operations Advisories Modal */}
      {showAlertModal && (
        <div className="modal-backdrop" onClick={() => setShowAlertModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Siren size={20} className="text-red" />
                <h3>City of Naga Relief Operations Advisories</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAlertModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="alert-modal-card critical">
                <div className="alert-modal-title">
                  <AlertTriangle size={18} className="text-red" />
                  <h4>Active Relief Distribution & Aid Dispatch — City of Naga, Cebu</h4>
                </div>
                <p>
                  Relief aid distribution is underway for affected families in priority barangays (Cantao-an, Lutac, Uling, Tinaan, and Inoburan). Relief packs include food supplies, potable water, and medical essentials.
                </p>
                <ul className="alert-checklist">
                  <li>Coordinate with your designated Barangay Relief Coordinator for household verification.</li>
                  <li>Present a valid ID or household representative slip at your assigned distribution center.</li>
                  <li>Report priority medical or infant formula needs directly via the ReliefTrack Request portal.</li>
                </ul>
              </div>

              <div className="alert-modal-card info">
                <div className="alert-modal-title">
                  <ShieldCheck size={18} className="text-bright-blue" />
                  <h4>Relief Operations Hotlines & Hubs</h4>
                </div>
                <div className="hotline-grid">
                  <div className="hotline-box">
                    <span className="hotline-label">Relief Operations Hotline</span>
                    <span className="hotline-num">(032) 489-8988 / 0917-702-6242</span>
                  </div>
                  <div className="hotline-box">
                    <span className="hotline-label">City Social Welfare & Dev (CSWD)</span>
                    <span className="hotline-num">(032) 272-4000</span>
                  </div>
                  <div className="hotline-box">
                    <span className="hotline-label">Central Relief Staging Hub</span>
                    <span className="hotline-num">(032) 272-3333</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowAlertModal(false)}
              >
                Close Advisory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        initialRequests={requests}
        user={user}
        profile={profile}
      />
    </DashboardLayout>
  )
}
