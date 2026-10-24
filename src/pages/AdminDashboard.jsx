import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  subscribeReliefRequests,
  updateReliefRequestStatus,
  deleteReliefRequest,
} from '../firebase/requests'
import { subscribeInventoryItems } from '../firebase/inventory'
import { subscribeFamilies } from '../firebase/families'
import { getBrowserLocation } from '../utils/getBrowserLocation'
import { FALLBACK_SCHOOLS } from '../utils/nearbyEvacCenters'
import { formatRequestDate, getStatusLabel, getStatusClass } from '../utils/requestHelpers'
import DashboardLayout from '../components/DashboardLayout'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/AdminDashboard.css'
import {
  Files,
  Hourglass,
  CircleCheck,
  Siren,
  Users,
  Package,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  X,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  Map,
  ArrowRight,
  UserPlus,
  Trash2,
  Clock,
  ExternalLink,
} from 'lucide-react'

const NAGA_CENTER = [10.2085, 123.7591]

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

export default function AdminDashboard() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('operations') // 'operations' | 'users'
  const [dateFilter, setDateFilter] = useState('all') // 'all' | 'today' | '7d' | '30d'

  // Data Collections
  const [requests, setRequests] = useState([])
  const [inventory, setInventory] = useState([])
  const [families, setFamilies] = useState([])
  const [users, setUsers] = useState(() =>
    INITIAL_AUTH_USERS.map((a) => ({
      docId: `user_${a.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      ...a,
    }))
  )
  const [loading, setLoading] = useState(true)

  // Filters for Operations
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatusFilter, setRequestStatusFilter] = useState('All')

  // Modals for Operations
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null) // { action, requestId, docId, targetStatus }
  const [actionLoading, setActionLoading] = useState(false)

  // User Management Filters & Modals (Preserved 100%)
  const [userSearch, setUserSearch] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('All')
  const [userRoleFilter, setUserRoleFilter] = useState('All')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [holdTarget, setHoldTarget] = useState(null)
  const [isHolding, setIsHolding] = useState(false)

  const [editLocationTarget, setEditLocationTarget] = useState(null)
  const [editLocationValue, setEditLocationValue] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [isDetectingLoc, setIsDetectingLoc] = useState(false)

  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    location: '',
    role: 'Member',
    password: '',
  })
  const [isAddingUser, setIsAddingUser] = useState(false)

  const [isSyncing, setIsSyncing] = useState(false)
  const autoSyncedRef = useRef(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin =
    (adminEmail && user?.email?.toLowerCase() === adminEmail.toLowerCase()) ||
    userProfile?.role === 'Admin' ||
    profile?.role === 'Admin'

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Administrator'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  // Subscriptions to live Firestore collections
  useEffect(() => {
    const unsubUsers = subscribeUsers(
      (data) => setUsers(data),
      (err) => console.error('Error fetching users:', err)
    )

    const unsubRequests = subscribeReliefRequests(
      (data) => {
        setRequests(data)
        setLoading(false)
      },
      (err) => console.error('Error fetching requests:', err),
      { uid: user?.uid, role: 'Admin' }
    )

    const unsubInventory = subscribeInventoryItems(
      (data) => setInventory(data),
      (err) => console.error('Error fetching inventory:', err)
    )

    const unsubFamilies = subscribeFamilies(
      (data) => setFamilies(data),
      (err) => console.error('Error fetching families:', err),
      { uid: user?.uid, role: 'Admin' }
    )

    return () => {
      unsubUsers()
      unsubRequests()
      unsubInventory()
      unsubFamilies()
    }
  }, [user?.uid])

  // Auto-sync missing accounts from Firebase Auth on initial load
  useEffect(() => {
    if (!loading && !autoSyncedRef.current && users.length > 0) {
      autoSyncedRef.current = true
      syncAuthUsersToFirestore(users)
        .then((addedCount) => {
          if (addedCount > 0) {
            showToast(
              `Synchronized ${addedCount} registered account${addedCount === 1 ? '' : 's'} from Firebase!`,
              'success'
            )
          }
        })
        .catch((err) => console.error('Auto-sync error:', err))
    }
  }, [loading, users])

  // Date Filter calculations for Requests
  const dateFilteredRequests = useMemo(() => {
    if (dateFilter === 'all') return requests
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const msInDay = 24 * 60 * 60 * 1000

    return requests.filter((r) => {
      if (!r.createdAt) return false
      const reqMs = r.createdAt.getTime ? r.createdAt.getTime() : new Date(r.createdAt).getTime()
      if (isNaN(reqMs)) return false

      if (dateFilter === 'today') {
        return now - reqMs < msInDay
      }
      if (dateFilter === '7d') {
        return now - reqMs < 7 * msInDay
      }
      if (dateFilter === '30d') {
        return now - reqMs < 30 * msInDay
      }
      return true
    })
  }, [requests, dateFilter])

  // Overview Statistics (Calculated from real data)
  const totalRequestsCount = dateFilteredRequests.length
  const pendingRequestsCount = dateFilteredRequests.filter((r) => r.status === 'pending').length
  const activeOpsCount = dateFilteredRequests.filter((r) => r.status === 'in-progress').length
  const completedOpsCount = dateFilteredRequests.filter((r) => r.status === 'completed').length
  const registeredBeneficiariesCount = families.length
  const totalSuppliesCount = inventory.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
  const lowStockItemsCount = inventory.filter((it) => (Number(it.quantity) || 0) < 20).length

  // Filtered Requests for Table
  const filteredRequests = useMemo(() => {
    return dateFilteredRequests.filter((r) => {
      const q = requestSearch.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (r.requestId && r.requestId.toLowerCase().includes(q)) ||
        (r.requesterName && r.requesterName.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))

      const matchesStatus =
        requestStatusFilter === 'All' ||
        (requestStatusFilter === 'Pending' && r.status === 'pending') ||
        (requestStatusFilter === 'In Progress' && r.status === 'in-progress') ||
        (requestStatusFilter === 'Completed' && r.status === 'completed')

      return matchesSearch && matchesStatus
    })
  }, [dateFilteredRequests, requestSearch, requestStatusFilter])

  // Priority classification helper
  const getRequestPriority = (r) => {
    let score = 0
    if (r.categories) {
      if (r.categories.pwd?.count > 0) score += 3
      if (r.categories.pregnantWomen?.count > 0) score += 3
      if (r.categories.elders?.count > 0) score += 2
      if (r.categories.childrenBelow7?.count > 0) score += 2
    }
    const desc = (r.description || '').toLowerCase()
    if (desc.includes('urgent') || desc.includes('emergency') || desc.includes('flood') || desc.includes('trapped')) {
      score += 4
    }
    if (score >= 4) return { label: 'Critical', class: 'priority-critical' }
    if (score >= 2) return { label: 'High', class: 'priority-high' }
    return { label: 'Normal', class: 'priority-normal' }
  }

  // Urgent/Critical Incidents List
  const urgentIncidents = useMemo(() => {
    return requests
      .filter((r) => r.status !== 'completed' && getRequestPriority(r).label !== 'Normal')
      .slice(0, 4)
  }, [requests])

  // Status update confirmation
  const handleConfirmStatusChange = async () => {
    if (!confirmModal) return
    setActionLoading(true)
    try {
      if (confirmModal.action === 'delete') {
        await deleteReliefRequest(confirmModal.docId)
        showToast(`Request ${confirmModal.requestId} has been removed.`)
      } else {
        await updateReliefRequestStatus(confirmModal.docId, confirmModal.targetStatus)
        showToast(
          `Request ${confirmModal.requestId} updated to ${getStatusLabel(confirmModal.targetStatus)}!`
        )
      }
      setConfirmModal(null)
    } catch (err) {
      console.error('Status change error:', err)
      showToast('Failed to update request status.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // User Management Presence Helpers (Preserved 100%)
  const isUserOnline = useCallback((u) => {
    if (user?.uid && u.docId === user.uid) return true
    if (u.isOnline === false) return false
    if (!u.lastActiveAt) return false
    const ms = u.lastActiveAt?.toMillis
      ? u.lastActiveAt.toMillis()
      : typeof u.lastActiveAt === 'number'
      ? u.lastActiveAt
      : new Date(u.lastActiveAt).getTime()
    if (isNaN(ms)) return false
    return Date.now() - ms < 3 * 60 * 1000
  }, [user])

  const userStats = useMemo(() => {
    const total = users.length
    const online = users.filter((u) => isUserOnline(u)).length
    const onHold = users.filter((u) => u.status === 'On Hold').length
    const admins = users.filter((u) => u.role === 'Admin').length
    return { total, online, onHold, admins }
  }, [users, isUserOnline])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.location && u.location.toLowerCase().includes(q))

      const online = isUserOnline(u)
      const matchesStatus =
        userStatusFilter === 'All' ||
        (userStatusFilter === 'Online' && online) ||
        (userStatusFilter === 'Offline' && !online) ||
        (userStatusFilter === 'Active' && u.status !== 'On Hold') ||
        (userStatusFilter === 'On Hold' && u.status === 'On Hold')

      const role = u.role === 'Admin' ? 'Admin' : 'Member'
      const matchesRole = userRoleFilter === 'All' || role === userRoleFilter

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, userSearch, userStatusFilter, userRoleFilter, isUserOnline])

  // User Management Actions
  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      const addedCount = await syncAuthUsersToFirestore(users)
      if (addedCount > 0) {
        showToast(
          `Synchronized ${addedCount} account${addedCount === 1 ? '' : 's'} from Firebase Authentication!`
        )
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

  const handleAddUserSubmit = async (e) => {
    e.preventDefault()
    if (!newUserData.email) return
    setIsAddingUser(true)
    try {
      const res = await addUserAccount(newUserData)
      showToast(
        res?.hasAuth
          ? `User account ${res.email} created with login credentials!`
          : `User account ${res?.email || newUserData.email} added successfully!`,
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

  const confirmHoldToggle = async () => {
    if (!holdTarget) return
    setIsHolding(true)
    try {
      await setUserStatus(holdTarget.docId, holdTarget.nextStatus)
      showToast(
        `Account ${holdTarget.nextStatus === 'On Hold' ? 'placed On Hold' : 'Reactivated'} for ${holdTarget.displayName || holdTarget.email}`
      )
      setHoldTarget(null)
    } catch (err) {
      console.error('Error updating status:', err)
      showToast('Failed to update account status.', 'error')
    } finally {
      setIsHolding(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteUserProfile(deleteTarget.docId)
      showToast(`Account removed for ${deleteTarget.displayName || deleteTarget.email}`)
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting account:', err)
      showToast('Failed to delete account.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

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

  const handleDetectForTarget = async () => {
    setIsDetectingLoc(true)
    try {
      const loc = await getBrowserLocation()
      if (loc) {
        setEditLocationValue(loc)
        showToast(`Detected location: ${loc}`)
      } else {
        showToast('Could not detect device location. Check permissions.', 'warning')
      }
    } catch {
      showToast('Location detection failed.', 'error')
    } finally {
      setIsDetectingLoc(false)
    }
  }

  // Security Access Control
  if (!loading && !isAdmin) {
    return (
      <DashboardLayout title="Access Denied" userLabel={displayName} userEmail={email}>
        <div className="admin-access-denied">
          <div className="access-denied-card">
            <AlertTriangle size={48} className="text-red" />
            <h2>Administrator Access Restricted</h2>
            <p>
              Your account ({email}) does not have administrative privileges to manage city-wide relief operations.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/home')}
            >
              Return to Community Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Admin Dashboard" userLabel={displayName} userEmail={email}>
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Admin Dashboard Header */}
      <div className="admin-dashboard-header">
        <div className="admin-header-main">
          <div className="admin-title-row">
            <h2 className="admin-title">Admin Dashboard</h2>
            <span className="admin-badge-eoc">
              <span className="live-pulse" /> Naga EOC Live Operations
            </span>
          </div>
          <p className="admin-subtitle">
            Coordinate emergency relief operations, approve requests, monitor active incidents, and manage resources across the City of Naga, Cebu.
          </p>
        </div>

        {/* Date Filter & Tab Controls */}
        <div className="admin-header-controls">
          <div className="date-filter-group">
            <span className="filter-label">Date Filter:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div className="admin-tabs-toggle">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`}
              onClick={() => setActiveTab('operations')}
            >
              <Siren size={16} />
              <span>Operations & Relief</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              <span>User Accounts ({users.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Administrative Overview Statistic Cards */}
      <div className="admin-stats-grid-six">
        {/* Total Relief Requests */}
        <div className="admin-stat-card card-requests">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-navy">
              <Files size={22} />
            </div>
            <span className="stat-trend">Live</span>
          </div>
          <div className="stat-value">{loading ? '—' : totalRequestsCount}</div>
          <div className="stat-label">Total Relief Requests</div>
        </div>

        {/* Pending Approvals */}
        <div className="admin-stat-card card-pending">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-orange">
              <Hourglass size={22} />
            </div>
            <span className="stat-badge-orange">Needs Action</span>
          </div>
          <div className="stat-value text-orange">{loading ? '—' : pendingRequestsCount}</div>
          <div className="stat-label">Pending Approvals</div>
        </div>

        {/* Active Incidents / Operations */}
        <div className="admin-stat-card card-operations">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-blue">
              <Siren size={22} />
            </div>
            <span className="stat-badge-blue">In Dispatch</span>
          </div>
          <div className="stat-value text-bright-blue">{loading ? '—' : activeOpsCount}</div>
          <div className="stat-label">Active Operations</div>
        </div>

        {/* Completed Operations */}
        <div className="admin-stat-card card-completed">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-green">
              <CircleCheck size={22} />
            </div>
            <span className="stat-badge-green">Delivered</span>
          </div>
          <div className="stat-value text-green">{loading ? '—' : completedOpsCount}</div>
          <div className="stat-label">Completed Operations</div>
        </div>

        {/* Registered Beneficiaries */}
        <div className="admin-stat-card card-beneficiaries">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-navy">
              <Users size={22} />
            </div>
            <span className="stat-badge-gray">Families</span>
          </div>
          <div className="stat-value">{loading ? '—' : registeredBeneficiariesCount}</div>
          <div className="stat-label">Registered Beneficiaries</div>
        </div>

        {/* Relief Inventory Supplies */}
        <div className="admin-stat-card card-inventory">
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-blue">
              <Package size={22} />
            </div>
            {lowStockItemsCount > 0 ? (
              <span className="stat-badge-orange">{lowStockItemsCount} Low Stock</span>
            ) : (
              <span className="stat-badge-green">Stocked</span>
            )}
          </div>
          <div className="stat-value">{loading ? '—' : totalSuppliesCount}</div>
          <div className="stat-label">Available Relief Inventory</div>
        </div>
      </div>

      {/* TAB 1: OPERATIONS & RELIEF MANAGEMENT */}
      {activeTab === 'operations' && (
        <div className="admin-tab-content">
          {/* Urgent Incidents & Priority Assessment Section */}
          {urgentIncidents.length > 0 && (
            <div className="admin-priority-section">
              <div className="priority-section-header">
                <div className="priority-header-title">
                  <AlertTriangle size={20} className="text-red" />
                  <h3>Urgent Relief & High-Priority Incidents</h3>
                </div>
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={() => navigate('/priority')}
                >
                  View Priority Matrix <ArrowRight size={14} />
                </button>
              </div>

              <div className="urgent-incidents-grid">
                {urgentIncidents.map((inc) => {
                  const prio = getRequestPriority(inc)
                  return (
                    <div key={inc.docId} className="urgent-incident-card">
                      <div className="incident-card-top">
                        <span className={`priority-badge ${prio.class}`}>
                          {prio.label} Priority
                        </span>
                        <span className="incident-time">
                          {formatRequestDate(inc.createdAt)}
                        </span>
                      </div>
                      <div className="incident-loc">
                        <MapPin size={15} className="text-bright-blue" />
                        <strong>{inc.location || 'City of Naga'}</strong>
                      </div>
                      <p className="incident-desc">
                        {inc.description || 'Emergency food packs and water required.'}
                      </p>
                      <div className="incident-meta-row">
                        <span className="meta-beneficiary">
                          Requester: {inc.requesterName || inc.createdByName || 'Community'}
                        </span>
                        {inc.familyMembers > 0 && (
                          <span className="meta-members">
                            <Users size={12} /> {inc.familyMembers} pax
                          </span>
                        )}
                      </div>
                      <div className="incident-card-actions">
                        <button
                          type="button"
                          className="btn-action-small"
                          onClick={() => setSelectedRequest(inc)}
                        >
                          View Details
                        </button>
                        {inc.status === 'pending' && (
                          <button
                            type="button"
                            className="btn-primary-small"
                            onClick={() =>
                              setConfirmModal({
                                action: 'approve',
                                requestId: inc.requestId,
                                docId: inc.docId,
                                targetStatus: 'in-progress',
                              })
                            }
                          >
                            Dispatch Aid
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Relief Request Management Table Section */}
          <div className="admin-requests-section">
            <div className="requests-section-header">
              <div className="requests-header-left">
                <h3 className="section-title">Relief Request Management</h3>
                <span className="section-subtitle">
                  Review incoming requests, verify barangay locations, and dispatch aid
                </span>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="requests-toolbar">
                <div className="toolbar-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Search by ID, name, barangay..."
                  />
                  {requestSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setRequestSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="toolbar-status-filter">
                  {['All', 'Pending', 'In Progress', 'Completed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`status-pill-btn ${requestStatusFilter === st ? 'active' : ''}`}
                      onClick={() => setRequestStatusFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-table-container">
              {loading ? (
                <div className="admin-loading-state">
                  <div className="loading-spinner" />
                  <span>Loading operations data...</span>
                </div>
              ) : filteredRequests.length > 0 ? (
                <div className="table-responsive">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Requester / Beneficiary</th>
                        <th>Barangay Location</th>
                        <th>Relief Assistance Needed</th>
                        <th>Date</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((req) => {
                        const prio = getRequestPriority(req)
                        return (
                          <tr key={req.docId}>
                            <td className="font-mono font-medium text-navy">
                              {req.requestId}
                            </td>
                            <td>
                              <div className="table-user-cell">
                                <span className="font-semibold text-navy">
                                  {req.requesterName || req.createdByName || 'Beneficiary'}
                                </span>
                                {req.familyMembers > 0 && (
                                  <span className="text-xs text-muted">
                                    {req.familyMembers} household members
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="table-loc-cell">
                                <MapPin size={14} className="text-bright-blue" />
                                <span>{req.location || 'City of Naga'}</span>
                              </div>
                            </td>
                            <td>
                              <span className="table-desc-text" title={req.description}>
                                {req.description || 'General Relief Goods'}
                              </span>
                            </td>
                            <td className="text-muted">
                              {formatRequestDate(req.createdAt)}
                            </td>
                            <td>
                              <span className={`priority-badge ${prio.class}`}>
                                {prio.label}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${getStatusClass(req.status)}`}>
                                {req.status === 'pending' && <Hourglass size={12} />}
                                {req.status === 'in-progress' && <Clock size={12} />}
                                {req.status === 'completed' && <CircleCheck size={12} />}
                                <span>{getStatusLabel(req.status)}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-group">
                                <button
                                  type="button"
                                  className="btn-table-icon"
                                  onClick={() => setSelectedRequest(req)}
                                  title="View Full Details"
                                >
                                  <Eye size={15} />
                                </button>

                                {req.status === 'pending' && (
                                  <button
                                    type="button"
                                    className="btn-table-action approve"
                                    onClick={() =>
                                      setConfirmModal({
                                        action: 'approve',
                                        requestId: req.requestId,
                                        docId: req.docId,
                                        targetStatus: 'in-progress',
                                      })
                                    }
                                    title="Approve & Dispatch"
                                  >
                                    Approve
                                  </button>
                                )}

                                {req.status === 'in-progress' && (
                                  <button
                                    type="button"
                                    className="btn-table-action complete"
                                    onClick={() =>
                                      setConfirmModal({
                                        action: 'complete',
                                        requestId: req.requestId,
                                        docId: req.docId,
                                        targetStatus: 'completed',
                                      })
                                    }
                                    title="Mark Completed"
                                  >
                                    Complete
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn-table-icon text-red"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'delete',
                                      requestId: req.requestId,
                                      docId: req.docId,
                                    })
                                  }
                                  title="Delete Request"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state">
                  <Files size={40} className="text-muted" />
                  <h4>No relief requests found</h4>
                  <p>No matching requests with current filter criteria.</p>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Operations Layout: Inventory Overview + Disaster Map */}
          <div className="admin-grid-two-col">
            {/* Inventory Overview */}
            <div className="admin-panel inventory-snapshot-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Package size={18} className="text-bright-blue" />
                  <h4 className="panel-title">Relief Supplies & Inventory</h4>
                </div>
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={() => navigate('/inventory')}
                >
                  Manage Full Inventory <ExternalLink size={14} />
                </button>
              </div>

              <div className="inventory-snapshot-body">
                {inventory.length > 0 ? (
                  <div className="inventory-snapshot-list">
                    {inventory.slice(0, 5).map((item) => {
                      const qty = Number(item.quantity) || 0
                      const isLow = qty < 20 && qty >= 5
                      const isCritical = qty < 5
                      return (
                        <div key={item.docId} className="inventory-snapshot-item">
                          <div className="item-meta">
                            <span className="item-name">{item.name}</span>
                            <span className="item-category">{item.category} • {item.storageLocation || 'Naga Warehouse'}</span>
                          </div>
                          <div className="item-stock-box">
                            <span className="item-qty">
                              {qty} {item.unit || 'units'}
                            </span>
                            <span
                              className={`stock-badge ${
                                isCritical ? 'critical' : isLow ? 'low' : 'sufficient'
                              }`}
                            >
                              {isCritical ? 'Critical' : isLow ? 'Low Stock' : 'Sufficient'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="panel-empty-text">
                    No inventory records found. Go to Inventory Management to register supplies.
                  </div>
                )}
              </div>
            </div>

            {/* Operations Map Preview */}
            <div className="admin-panel operations-map-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Map size={18} className="text-navy" />
                  <h4 className="panel-title">Disaster Operations Map Preview</h4>
                </div>
                <button
                  type="button"
                  className="btn-link-small"
                  onClick={() => navigate('/map')}
                >
                  Open Operations Map <ExternalLink size={14} />
                </button>
              </div>

              <div className="operations-map-wrap">
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
                  {FALLBACK_SCHOOLS.slice(0, 8).map((school) => (
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

                  {/* Requests with coordinates */}
                  {requests
                    .filter((r) => r.lat != null && r.lng != null)
                    .map((r) => (
                      <Marker
                        key={r.docId}
                        position={[Number(r.lat), Number(r.lng)]}
                        icon={requestMarkerIcon(r.status)}
                      >
                        <Popup>
                          <strong>{r.requestId}</strong>
                          <br />
                          {r.requesterName || 'Beneficiary'}
                          <br />
                          Status: {getStatusLabel(r.status)}
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>

                <div className="map-legend-row">
                  <div className="legend-chip">
                    <span className="dot dot-green" /> Evacuation Centers
                  </div>
                  <div className="legend-chip">
                    <span className="dot dot-orange" /> Pending Requests
                  </div>
                  <div className="legend-chip">
                    <span className="dot dot-blue" /> Dispatched / Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT & ACCOUNTS (PRESERVED 100%) */}
      {activeTab === 'users' && (
        <div className="admin-tab-content">
          {/* User Management Stat Cards */}
          <div className="admin-stats user-stats-grid">
            <div className="admin-stat-card">
              <div className="stat-card-top">
                <Users size={20} className="text-navy" />
              </div>
              <div className="admin-stat-value">{loading ? '—' : userStats.total}</div>
              <div className="admin-stat-label">Total Accounts</div>
            </div>

            <div className="admin-stat-card stat-online">
              <div className="stat-card-top">
                <span className="live-pulse" />
              </div>
              <div className="admin-stat-value text-online">
                {loading ? '—' : userStats.online}
              </div>
              <div className="admin-stat-label">Online Now</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-top">
                <Hourglass size={20} className="text-orange" />
              </div>
              <div className="admin-stat-value text-orange">
                {loading ? '—' : userStats.onHold}
              </div>
              <div className="admin-stat-label">On Hold</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-top">
                <ShieldCheck size={20} className="text-bright-blue" />
              </div>
              <div className="admin-stat-value text-bright-blue">
                {loading ? '—' : userStats.admins}
              </div>
              <div className="admin-stat-label">Administrators</div>
            </div>
          </div>

          {/* User Management Toolbar */}
          <div className="admin-controls-card">
            <div className="admin-search-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search registered accounts by name, email, or barangay..."
              />
              {userSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setUserSearch('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="admin-filters-row">
              <div className="admin-filter-item">
                <span className="filter-label">Status:</span>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="admin-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="Online">Online Now</option>
                  <option value="Offline">Offline</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div className="admin-filter-item">
                <span className="filter-label">Role:</span>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="admin-select"
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Member">Member</option>
                </select>
              </div>

              <div className="admin-actions-group">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsAddUserOpen(true)}
                >
                  <UserPlus size={16} />
                  <span>Add User</span>
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                >
                  <RefreshCw size={15} className={isSyncing ? 'spinning' : ''} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Auth'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="admin-table-container">
            {filteredUsers.length > 0 ? (
              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>Assigned Location</th>
                      <th>System Role</th>
                      <th>Account Status</th>
                      <th style={{ textAlign: 'right' }}>Management Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const online = isUserOnline(u)
                      return (
                        <tr key={u.docId}>
                          <td>
                            <div className="user-account-cell">
                              <div
                                className={`user-avatar ${
                                  u.role === 'Admin' ? 'admin' : 'member'
                                }`}
                              >
                                {(u.displayName || u.email || 'U').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="user-text-meta">
                                <span className="font-semibold text-navy">
                                  {u.displayName || 'No Name'}
                                </span>
                                <span className="text-xs text-muted">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="user-loc-cell">
                              <MapPin size={14} className="text-bright-blue" />
                              <span>{u.location || 'City of Naga, Cebu'}</span>
                              <button
                                type="button"
                                className="btn-table-icon"
                                onClick={() => {
                                  setEditLocationTarget(u)
                                  setEditLocationValue(u.location || '')
                                }}
                                title="Edit Location"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`role-badge ${
                                u.role === 'Admin' ? 'admin' : 'member'
                              }`}
                            >
                              {u.role === 'Admin' ? 'Administrator' : 'Member'}
                            </span>
                          </td>
                          <td>
                            <div className="user-status-cell">
                              <span
                                className={`online-indicator ${
                                  online ? 'online' : 'offline'
                                }`}
                              />
                              <span>{online ? 'Online' : 'Offline'}</span>
                              {u.status === 'On Hold' && (
                                <span className="badge-on-hold">On Hold</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-actions-group">
                              <button
                                type="button"
                                className="btn-table-action"
                                onClick={() => toggleRole(u)}
                                title="Toggle Administrator / Member role"
                              >
                                Make {u.role === 'Admin' ? 'Member' : 'Admin'}
                              </button>
                              <button
                                type="button"
                                className={`btn-table-action ${
                                  u.status === 'On Hold' ? 'reactivate' : 'hold'
                                }`}
                                onClick={() =>
                                  setHoldTarget({
                                    ...u,
                                    nextStatus: u.status === 'On Hold' ? 'Active' : 'On Hold',
                                  })
                                }
                              >
                                {u.status === 'On Hold' ? 'Reactivate' : 'Hold'}
                              </button>
                              <button
                                type="button"
                                className="btn-table-icon text-red"
                                onClick={() => setDeleteTarget(u)}
                                title="Delete user account"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty-state">
                <Users size={40} className="text-muted" />
                <h4>No users found</h4>
                <p>No matching user accounts with current filters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Files size={20} className="text-bright-blue" />
                <h3>Relief Request: {selectedRequest.requestId}</h3>
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
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${getStatusClass(selectedRequest.status)}`}>
                  {getStatusLabel(selectedRequest.status)}
                </span>
                <span className="detail-date">
                  Submitted: {formatRequestDate(selectedRequest.createdAt)}
                </span>
              </div>

              <div className="detail-card">
                <div className="detail-field">
                  <span className="field-label">Requester Name</span>
                  <div className="field-value">
                    {selectedRequest.requesterName || selectedRequest.createdByName || 'Community Beneficiary'}
                  </div>
                </div>

                <div className="detail-field">
                  <span className="field-label">Household Size</span>
                  <div className="field-value">
                    {selectedRequest.familyMembers || 1} members
                  </div>
                </div>

                <div className="detail-field full-width">
                  <span className="field-label">Barangay / Address</span>
                  <div className="field-value">
                    <MapPin size={16} className="text-bright-blue" />
                    <span>{selectedRequest.location || 'City of Naga, Cebu'}</span>
                  </div>
                </div>

                <div className="detail-field full-width">
                  <span className="field-label">Needs & Notes</span>
                  <div className="field-value-box">
                    {selectedRequest.description || 'General relief aid package required.'}
                  </div>
                </div>

                {selectedRequest.categories && (
                  <div className="detail-field full-width">
                    <span className="field-label">Vulnerable Demographics</span>
                    <div className="detail-tags-list">
                      {selectedRequest.categories.pregnantWomen?.count > 0 && (
                        <span className="category-pill">
                          Pregnant Women: {selectedRequest.categories.pregnantWomen.count}
                        </span>
                      )}
                      {selectedRequest.categories.elders?.count > 0 && (
                        <span className="category-pill">
                          Elders: {selectedRequest.categories.elders.count}
                        </span>
                      )}
                      {selectedRequest.categories.pwd?.count > 0 && (
                        <span className="category-pill">
                          PWD: {selectedRequest.categories.pwd.count}
                        </span>
                      )}
                      {selectedRequest.categories.childrenBelow7?.count > 0 && (
                        <span className="category-pill">
                          Children & Infants: {selectedRequest.categories.childrenBelow7.count}
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
              {selectedRequest.status === 'pending' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setConfirmModal({
                      action: 'approve',
                      requestId: selectedRequest.requestId,
                      docId: selectedRequest.docId,
                      targetStatus: 'in-progress',
                    })
                    setSelectedRequest(null)
                  }}
                >
                  Approve & Dispatch
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Approve / Complete / Delete */}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal-container modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <AlertTriangle
                  size={20}
                  className={confirmModal.action === 'delete' ? 'text-red' : 'text-bright-blue'}
                />
                <h3>
                  {confirmModal.action === 'delete'
                    ? 'Delete Relief Request'
                    : confirmModal.action === 'approve'
                    ? 'Approve Relief Request'
                    : 'Mark Request as Completed'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConfirmModal(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to {confirmModal.action}{' '}
                <strong>{confirmModal.requestId}</strong>?
                {confirmModal.action === 'approve' &&
                  ' This will transition the request to In-Progress and dispatch relief operations.'}
                {confirmModal.action === 'complete' &&
                  ' This confirms all requested supplies have been successfully delivered to the beneficiary.'}
                {confirmModal.action === 'delete' &&
                  ' This action will permanently remove the relief request record.'}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirmModal.action === 'delete' ? 'btn-danger' : 'btn-primary'}
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <UserPlus size={20} className="text-bright-blue" />
                <h3>Create New User Account</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddUserOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    placeholder="e.g. Maria Santos"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    placeholder="e.g. maria@relieftrack.com"
                  />
                </div>
                <div className="form-group">
                  <label>Password (optional for quick profile)</label>
                  <input
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="form-group">
                  <label>Assigned Barangay / Location</label>
                  <input
                    type="text"
                    value={newUserData.location}
                    onChange={(e) => setNewUserData({ ...newUserData, location: e.target.value })}
                    placeholder="e.g. Brgy. Tinaan, City of Naga, Cebu"
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  >
                    <option value="Member">Community Member</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isAddingUser}>
                  {isAddingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {editLocationTarget && (
        <div className="modal-backdrop" onClick={() => setEditLocationTarget(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <MapPin size={20} className="text-bright-blue" />
                <h3>Update User Location</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditLocationTarget(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLocation}>
              <div className="modal-body">
                <p className="text-sm text-muted">
                  Updating assigned location for{' '}
                  <strong>{editLocationTarget.displayName || editLocationTarget.email}</strong>.
                </p>
                <div className="form-group">
                  <label>Location / Barangay</label>
                  <input
                    type="text"
                    required
                    value={editLocationValue}
                    onChange={(e) => setEditLocationValue(e.target.value)}
                    placeholder="e.g. Brgy. Inoburan, City of Naga, Cebu"
                  />
                </div>
                <button
                  type="button"
                  className="btn-outline-small"
                  onClick={handleDetectForTarget}
                  disabled={isDetectingLoc}
                >
                  <MapPin size={14} />
                  <span>{isDetectingLoc ? 'Detecting GPS...' : 'Detect Device Location'}</span>
                </button>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setEditLocationTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSavingLocation}>
                  {isSavingLocation ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hold / Reactivate Modal */}
      {holdTarget && (
        <div className="modal-backdrop" onClick={() => setHoldTarget(null)}>
          <div className="modal-container modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {holdTarget.nextStatus === 'On Hold'
                  ? 'Place Account On Hold'
                  : 'Reactivate Account'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setHoldTarget(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to change status to{' '}
                <strong>{holdTarget.nextStatus}</strong> for user{' '}
                <strong>{holdTarget.displayName || holdTarget.email}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-outline" onClick={() => setHoldTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={holdTarget.nextStatus === 'On Hold' ? 'btn-danger' : 'btn-primary'}
                onClick={confirmHoldToggle}
                disabled={isHolding}
              >
                {isHolding ? 'Updating...' : `Confirm ${holdTarget.nextStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-container modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete Account</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to remove the account for{' '}
                <strong>{deleteTarget.displayName || deleteTarget.email}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
