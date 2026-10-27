import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import GenerateReportModal from '../components/GenerateReportModal'
import PieChart from '../components/PieChart'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FALLBACK_SCHOOLS } from '../utils/nearbyEvacCenters'
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
  Map,
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

const NAGA_CENTER = [10.2085, 123.7591]

// Custom Leaflet Icons using standard divs
const evacMarkerIcon = L.divIcon({
  className: 'custom-evac-marker',
  html: `
    <div style="
      width: 26px; height: 26px;
      background: #39A935;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: bold;
      font-size: 13px;
    ">
      🏫
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

const requestMarkerIcon = (status) => {
  const color =
    status === 'completed'
      ? '#39A935'
      : status === 'in-progress'
      ? '#1674D1'
      : '#F59E0B'
  return L.divIcon({
    className: 'custom-req-marker',
    html: `
      <div style="
        width: 24px; height: 24px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

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

  // Requests with coordinates for map preview
  const mapRequests = useMemo(() => {
    return requests.filter((r) => r.lat != null && r.lng != null)
  }, [requests])

  const handleQuickAction = (action) => {
    if (action === 'newRequest') {
      navigate('/requests', { state: { openForm: true } })
      return
    }
    if (action === 'viewMap') {
      navigate('/map')
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
          onClick={() => handleQuickAction('viewMap')}
        >
          <div className="quick-action-icon bg-navy">
            <Map size={22} />
          </div>
          <div className="quick-action-meta">
            <div className="quick-action-title">View Relief Map</div>
            <div className="quick-action-desc">Find active distribution centers & aid hubs</div>
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

      {/* Two Column Grid: Relief Operations Advisory Panel + Map Preview */}
      <div className="dashboard-grid-two-col">
        {/* Relief Advisory Panel */}
        <div className="dashboard-panel alert-panel">
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

        {/* Map Preview */}
        <div className="dashboard-panel map-preview-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <Map size={18} className="text-bright-blue" />
              <h4 className="panel-title">Naga City Operations Map</h4>
            </div>
            <button
              type="button"
              className="btn-link-small"
              onClick={() => navigate('/map')}
            >
              Open Full Map <ExternalLink size={14} />
            </button>
          </div>

          <div className="map-preview-container">
            <MapContainer
              center={NAGA_CENTER}
              zoom={12}
              scrollWheelZoom={false}
              style={{ width: '100%', height: '240px', borderRadius: '8px', zIndex: 1 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Naga City Evacuation Centers */}
              {FALLBACK_SCHOOLS.slice(0, 6).map((school) => (
                <Marker
                  key={school.name}
                  position={[school.lat, school.lng]}
                  icon={evacMarkerIcon}
                >
                  <Popup>
                    <strong>🏫 Evacuation Center</strong>
                    <br />
                    {school.name}
                    <br />
                    <small>{school.address}</small>
                  </Popup>
                </Marker>
              ))}

              {/* User's Requests on Map */}
              {mapRequests.map((req) => (
                <Marker
                  key={req.docId}
                  position={[Number(req.lat), Number(req.lng)]}
                  icon={requestMarkerIcon(req.status)}
                >
                  <Popup>
                    <strong>Request: {req.requestId}</strong>
                    <br />
                    Status: {getStatusLabel(req.status)}
                    <br />
                    {req.location}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <div className="map-preview-legend">
              <div className="legend-item">
                <span className="legend-dot dot-green" />
                <span>Evacuation Center</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-orange" />
                <span>Pending Request</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-blue" />
                <span>In-Progress / Dispatched</span>
              </div>
            </div>
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
