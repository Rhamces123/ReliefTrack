import { useEffect, useState, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createReliefRequest,
  subscribeReliefRequests,
  updateReliefRequestStatus,
  deleteReliefRequest,
  REQUEST_STATUSES,
} from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import LocationAutocomplete from '../components/LocationAutocomplete'
import RequestMiniMap from '../components/RequestMiniMap'
import {
  formatRequestDate,
  getStatusLabel,
  getStatusClass,
} from '../utils/requestHelpers'
import '../styles/Requests.css'
import {
  Plus,
  ClipboardList,
  Users,
  UsersRound,
  Home,
  Hourglass,
  Search,
  CheckCircle2,
  XCircle,
  X,
  MapPin,
  Trash2,
  Loader2,
  HeartPulse,
  Baby,
  Accessibility,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

const CATEGORY_META = {
  pregnantWomen: { label: 'Pregnant Women', icon: HeartPulse },
  elders: { label: 'Elderly / Seniors', icon: Users },
  pwd: { label: 'PWD', icon: Accessibility },
  childrenBelow7: { label: 'Children ≤ 7', icon: Baby },
}

const PRIMARY_NEED_OPTIONS = [
  'Family Food Pack',
  'Hygiene Kit',
  'Kitchen Kit',
  'Sleeping Kit',
  'Drinking Water',
  'Shelter Kit',
]

const ASSISTIVE_DEVICE_OPTIONS = [
  'Wheelchair',
  'Crutches',
  'Walker',
  'Walking Cane',
  'White Cane (Visually Impaired)',
  'Hearing Aid',
  'Prosthetic Limb',
  'Commode Chair',
]

const NAGA_BARANGAYS_LIST = [
  'Alpaco',
  'Bairan',
  'Balirong',
  'Cabungahan',
  'Cantao-an',
  'Central Poblacion',
  'Cogon',
  'Colon',
  'Inayagan',
  'Inoburan',
  'Langtad',
  'Lutac',
  'Mainit',
  'Mayana',
  'Naalad',
  'North Poblacion',
  'Pangdan',
  'Patag',
  'South Poblacion',
  'Tagjaguimit',
  'Tangke',
  'Tinaan',
  'Tuyan',
  'Uling',
]

const HOUSE_OWNERSHIP_OPTIONS = [
  { id: 'owner', label: 'Owner' },
  { id: 'renter', label: 'Renter' },
  { id: 'sharer', label: 'Sharer' },
  { id: 'informal-settler', label: 'Informal Settler' },
]

const SHELTER_DAMAGE_OPTIONS = [
  { id: 'none', label: 'Not Damaged / Intact' },
  { id: 'partially-damaged', label: 'Partially Damaged' },
  { id: 'totally-damaged', label: 'Totally Damaged' },
]

function detectBarangayFromText(text) {
  if (!text) return ''
  const t = text.toLowerCase()
  for (const b of NAGA_BARANGAYS_LIST) {
    if (t.includes(b.toLowerCase())) return b
  }
  return ''
}

const EMPTY_FORM = {
  requesterName: '',
  contactNumber: '',
  barangay: '',
  location: '',
  lat: null,
  lng: null,
  familyMembers: '',
  hasEvacuationCenter: false,
  is4PsBeneficiary: false,
  houseOwnership: 'owner',
  shelterDamage: 'none',
  description: '',
  primaryNeed: '',
  primaryNeeds: [],
  assistiveDevice: '',
  categories: {
    pregnantWomen: { count: '' },
    elders: { count: '' },
    pwd: { count: '' },
    childrenBelow7: { count: '' },
  },
}

function totalAffected(categories) {
  if (!categories) return 0
  return Object.values(categories).reduce((sum, c) => sum + (Number(c.count) || 0), 0)
}

export default function Requests() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(() => Boolean(location.state?.openForm))
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [detailRequest, setDetailRequest] = useState(null)
  const [locating, setLocating] = useState(false)

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setForm((f) => ({ ...f, lat: latitude, lng: longitude }))
        try {
          const params = new URLSearchParams({ lat: latitude.toFixed(5), lon: longitude.toFixed(5), format: 'json' })
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
            headers: { 'User-Agent': 'ReliefTrack/1.0' },
          })
          const data = await res.json()
          if (data?.display_name) {
            setForm((f) => {
              const detected = !f.barangay ? detectBarangayFromText(data.display_name) : ''
              return { ...f, location: data.display_name, ...(detected ? { barangay: detected } : {}) }
            })
          }
        } catch {
          // ignore reverse geocoding lookup failure
        }
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''
  const isAdmin = profile?.role === 'Admin'

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
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

  useEffect(() => {
    if (location.state?.openForm) {
      window.history.replaceState({}, document.title)
    }
  }, [location.state?.openForm])

  const filtered = useMemo(() => {
    let result = requests
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.categories && r.categories[categoryFilter] && (r.categories[categoryFilter].count || r.categories[categoryFilter].needs))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((r) =>
        (r.requesterName || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [requests, statusFilter, categoryFilter, search])

  // Pagination for Relief Requests (5 items per page)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, categoryFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedRequests = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE
    return filtered.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filtered, safePage])

  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (safePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages)
      } else if (safePage >= totalPages - 3) {
        pages.push(
          1,
          '...',
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        )
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages)
      }
    }
    return pages
  }

  const handlePageChange = useCallback((newPage, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
      if (typeof e.currentTarget?.blur === 'function') {
        e.currentTarget.blur()
      }
    }

    const dashContent = document.querySelector('.dashboard-content')
    const currentDashScroll = dashContent ? dashContent.scrollTop : 0
    const currentWindowScroll = window.scrollY || window.pageYOffset || 0

    setCurrentPage(newPage)

    requestAnimationFrame(() => {
      if (dashContent && dashContent.scrollTop !== currentDashScroll) {
        dashContent.scrollTop = currentDashScroll
      }
      if ((window.scrollY || window.pageYOffset || 0) !== currentWindowScroll) {
        window.scrollTo({ top: currentWindowScroll, behavior: 'instant' })
      }
      requestAnimationFrame(() => {
        if (dashContent && dashContent.scrollTop !== currentDashScroll) {
          dashContent.scrollTop = currentDashScroll
        }
        if ((window.scrollY || window.pageYOffset || 0) !== currentWindowScroll) {
          window.scrollTo({ top: currentWindowScroll, behavior: 'instant' })
        }
      })
    })
  }, [])

  const stats = useMemo(() => {
    const total = requests.length
    const totalPeople = requests.reduce((sum, r) => sum + totalAffected(r.categories), 0)
    const totalFamilies = requests.reduce((sum, r) => sum + (Number(r.familyMembers) || 0), 0)
    const withEvac = requests.filter((r) => r.hasEvacuationCenter).length
    const pending = requests.filter((r) => r.status === 'pending').length
    return { total, totalPeople, totalFamilies, withEvac, pending }
  }, [requests])

  const openForm = () => {
    setError('')
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const togglePrimaryNeed = (opt) => {
    setForm((f) => {
      const current = f.primaryNeeds || (f.primaryNeed ? [f.primaryNeed] : [])
      const next = current.includes(opt)
        ? current.filter((item) => item !== opt)
        : [...current, opt]
      return {
        ...f,
        primaryNeeds: next,
        primaryNeed: next.join(', '),
      }
    })
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.requesterName.trim()) {
      setError('Please provide the Head of Family / Requester Name.')
      return
    }
    if (!form.location.trim()) {
      setError('Please provide a location / address.')
      return
    }
    const activeNeeds = (form.primaryNeeds && form.primaryNeeds.length > 0)
      ? form.primaryNeeds
      : (form.primaryNeed ? [form.primaryNeed] : [])
    if (activeNeeds.length === 0) {
      setError('Please choose at least one relief item the family needs most.')
      return
    }

    const familyCount = parseInt(form.familyMembers, 10)
    const hasFamilyLimit = !isNaN(familyCount) && familyCount > 0
    const totalVuln = totalAffected(form.categories)

    if (hasFamilyLimit && totalVuln > familyCount) {
      setError(`Total vulnerable count (${totalVuln}) cannot exceed total family members (${familyCount}).`)
      return
    }

    if (hasFamilyLimit) {
      for (const [key, meta] of Object.entries(CATEGORY_META)) {
        const c = parseInt(form.categories[key]?.count, 10) || 0
        if (c > familyCount) {
          setError(`${meta.label} count (${c}) cannot exceed the number of family members (${familyCount}).`)
          return
        }
      }
    }

    setSaving(true)
    setError('')
    try {
      await createReliefRequest(
        {
          location: form.location,
          barangay: detectBarangayFromText(form.location),
          contactNumber: form.contactNumber,
          is4PsBeneficiary: form.is4PsBeneficiary,
          houseOwnership: form.houseOwnership,
          shelterDamage: form.shelterDamage,
          description: form.description,
          requesterName: form.requesterName,
          familyMembers: form.familyMembers,
          hasEvacuationCenter: form.hasEvacuationCenter,
          categories: form.categories,
          primaryNeed: activeNeeds.join(', '),
          primaryNeeds: activeNeeds,
          assistiveDevice: form.assistiveDevice,
          lat: form.lat,
          lng: form.lng,
        },
        user
      )
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      setError(err.message || 'Failed to create request.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (docId, status) => {
    setUpdatingId(docId)
    setError('')
    try {
      await updateReliefRequestStatus(docId, status)
    } catch (err) {
      setError(err.message || 'Failed to update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this relief request?')) return
    setUpdatingId(docId)
    setError('')
    try {
      await deleteReliefRequest(docId)
      if (detailRequest?.docId === docId) setDetailRequest(null)
    } catch (err) {
      setError(err.message || 'Failed to delete request.')
    } finally {
      setUpdatingId(null)
    }
  }

  const modalFamilyCount = parseInt(form.familyMembers, 10)
  const hasFamilyLimit = !isNaN(modalFamilyCount) && modalFamilyCount > 0
  const totalVulnCount = totalAffected(form.categories)
  const isTotalExceeded = hasFamilyLimit && totalVulnCount > modalFamilyCount
  const hasAnyIndividualExceeded = hasFamilyLimit && Object.values(form.categories).some(
    (c) => (parseInt(c.count, 10) || 0) > modalFamilyCount
  )
  const isFormExceeded = isTotalExceeded || hasAnyIndividualExceeded

  return (
    <DashboardLayout title="Requests" userLabel={displayName} userEmail={email}>
      <div className="requests-header">
        <div className="requests-header-text">
          <h2>Relief Requests</h2>
          <p>Create, manage, and monitor community relief aid requests across City of Naga.</p>
        </div>
        <button type="button" className="requests-btn-primary" onClick={openForm}>
          <Plus size={18} />
          <span>New Relief Request</span>
        </button>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && (
        <div className="requests-summary">
          <div className="requests-summary-card">
            <div className="requests-summary-icon-wrap icon-navy">
              <ClipboardList size={22} />
            </div>
            <div className="requests-summary-content">
              <div className="requests-summary-value">{stats.total}</div>
              <div className="requests-summary-label">Total Requests</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <div className="requests-summary-icon-wrap icon-blue">
              <Users size={22} />
            </div>
            <div className="requests-summary-content">
              <div className="requests-summary-value">{stats.totalPeople}</div>
              <div className="requests-summary-label">Affected People</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <div className="requests-summary-icon-wrap icon-navy">
              <UsersRound size={22} />
            </div>
            <div className="requests-summary-content">
              <div className="requests-summary-value">{stats.totalFamilies}</div>
              <div className="requests-summary-label">Family Members</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <div className="requests-summary-icon-wrap icon-green">
              <Home size={22} />
            </div>
            <div className="requests-summary-content">
              <div className="requests-summary-value">{stats.withEvac}</div>
              <div className="requests-summary-label">In Evacuation Centers</div>
            </div>
          </div>
          <div className="requests-summary-card pending">
            <div className="requests-summary-icon-wrap icon-orange">
              <Hourglass size={22} />
            </div>
            <div className="requests-summary-content">
              <div className="requests-summary-value">{stats.pending}</div>
              <div className="requests-summary-label">Pending Action</div>
            </div>
          </div>
        </div>
      )}

      <div className="requests-toolbar">
        <div className="requests-filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`requests-filter-tab ${statusFilter === f.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <span className="requests-filter-divider" />
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const Icon = meta.icon
            return (
              <button
                key={key}
                type="button"
                className={`requests-filter-tab cat ${categoryFilter === key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
              >
                <Icon size={14} />
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>
        <div className="requests-search-wrap">
          <span className="requests-search-icon">
            <Search size={16} />
          </span>
          <input
            type="text"
            className="requests-search-input"
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-activity">
        {loading && !error ? (
          <p className="requests-loading">Loading relief requests...</p>
        ) : error ? (
          <p className="dashboard-empty">
            Unable to load requests. Check Firestore permissions and try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className="dashboard-empty">
            {requests.length === 0
              ? 'No relief requests recorded yet. Click "New Relief Request" to create one.'
              : 'No requests match your current filters.'}
          </p>
        ) : (
          <>
            <div className="requests-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Family</th>
                    <th>Evac Center</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((row) => (
                    <tr
                      key={row.docId}
                      className="requests-row-clickable"
                      onClick={() => setDetailRequest(row)}
                    >
                      <td className="requests-id-cell">{row.requestId}</td>
                      <td><span className="requests-name-cell">{row.requesterName || '—'}</span></td>
                      <td className="requests-loc-cell">{row.location}</td>
                      <td>{row.familyMembers || '—'}</td>
                      <td>
                        {row.hasEvacuationCenter ? (
                          <span className="evac-badge active">
                            <CheckCircle2 size={13} />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="evac-badge inactive">
                            <XCircle size={13} />
                            <span>No</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`dashboard-status ${getStatusClass(row.status)}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="requests-date-cell">{formatRequestDate(row.createdAt)}</td>
                      <td className="requests-actions-cell" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <select
                            className="requests-status-select"
                            value={row.status}
                            disabled={updatingId === row.docId}
                            onChange={(e) => handleStatusChange(row.docId, e.target.value)}
                            aria-label="Update request status"
                          >
                            {REQUEST_STATUSES.map((s) => (
                              <option key={s} value={s}>{getStatusLabel(s)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="requests-status-readonly">{getStatusLabel(row.status)}</span>
                        )}
                        <button
                          type="button"
                          className="requests-delete-btn"
                          disabled={updatingId === row.docId}
                          onClick={() => handleDelete(row.docId)}
                          title="Delete request"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="requests-table-pagination">
              <div className="pagination-info">
                Showing <strong>{(safePage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                <strong>{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of{' '}
                <strong>{filtered.length}</strong> requests
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn nav-btn"
                  onClick={(e) => handlePageChange(Math.max(1, safePage - 1), e)}
                  disabled={safePage === 1}
                  title="Previous Page"
                >
                  <ChevronLeft size={15} />
                  <span>Prev</span>
                </button>

                <div className="pagination-pages">
                  {getPageNumbers().map((item, idx) =>
                    item === '...' ? (
                      <span key={`dots-${idx}`} className="pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        type="button"
                        className={`pagination-btn page-num ${safePage === item ? 'active' : ''}`}
                        onClick={(e) => handlePageChange(item, e)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="pagination-btn nav-btn"
                  onClick={(e) => handlePageChange(Math.min(totalPages, safePage + 1), e)}
                  disabled={safePage === totalPages}
                  title="Next Page"
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailRequest && (
        <div className="requests-overlay" onClick={() => setDetailRequest(null)}>
          <aside className="requests-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="requests-detail-header">
              <h3>{detailRequest.requesterName || 'Relief Request Details'}</h3>
              <button
                type="button"
                className="requests-detail-close"
                onClick={() => setDetailRequest(null)}
                aria-label="Close request details"
              >
                <X size={16} />
              </button>
            </div>
            <div className="requests-detail-body">
              <div className="requests-detail-section">
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Request ID</span>
                  <span className="requests-detail-value">{detailRequest.requestId}</span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Location</span>
                  <span className="requests-detail-value">{detailRequest.location}</span>
                </div>
                {detailRequest.barangay && (
                  <div className="requests-detail-row">
                    <span className="requests-detail-label">Barangay</span>
                    <span className="requests-detail-value">{detailRequest.barangay}</span>
                  </div>
                )}
                {detailRequest.contactNumber && (
                  <div className="requests-detail-row">
                    <span className="requests-detail-label">Contact</span>
                    <span className="requests-detail-value">{detailRequest.contactNumber}</span>
                  </div>
                )}
                <div className="requests-detail-row">
                  <span className="requests-detail-label">4Ps Beneficiary</span>
                  <span className="requests-detail-value">{detailRequest.is4PsBeneficiary ? 'Yes (4Ps Registered)' : 'No'}</span>
                </div>
                {detailRequest.houseOwnership && (
                  <div className="requests-detail-row">
                    <span className="requests-detail-label">House Ownership</span>
                    <span className="requests-detail-value" style={{ textTransform: 'capitalize' }}>{detailRequest.houseOwnership}</span>
                  </div>
                )}
                {detailRequest.shelterDamage && detailRequest.shelterDamage !== 'none' && (
                  <div className="requests-detail-row">
                    <span className="requests-detail-label">Shelter Damage</span>
                    <span className="requests-detail-value" style={{ textTransform: 'capitalize' }}>
                      {detailRequest.shelterDamage.replace('-', ' ')}
                    </span>
                  </div>
                )}
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Most Needed</span>
                  <span className="requests-detail-value">
                    {detailRequest.primaryNeeds && detailRequest.primaryNeeds.length > 0 ? (
                      <span className="requests-needs-badges">
                        {detailRequest.primaryNeeds.map((need) => (
                          <span key={need} className="requests-need-badge">{need}</span>
                        ))}
                      </span>
                    ) : (
                      detailRequest.primaryNeed || '—'
                    )}
                  </span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">PWD Assistive Device</span>
                  <span className="requests-detail-value">{detailRequest.assistiveDevice || 'None'}</span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Family Members</span>
                  <span className="requests-detail-value">{detailRequest.familyMembers || '—'}</span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Evacuation Center</span>
                  <span className="requests-detail-value">
                    {detailRequest.hasEvacuationCenter ? 'Yes (Evacuated)' : 'No (Home / Unverified)'}
                  </span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Status</span>
                  <span className={`dashboard-status ${getStatusClass(detailRequest.status)}`}>
                    {getStatusLabel(detailRequest.status)}
                  </span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Date Created</span>
                  <span className="requests-detail-value">{formatRequestDate(detailRequest.createdAt)}</span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Created By</span>
                  <span className="requests-detail-value">{detailRequest.createdByName || '—'}</span>
                </div>
              </div>

              {detailRequest.categories && Object.keys(detailRequest.categories).length > 0 && (
                <div className="requests-detail-section">
                  <div className="requests-detail-section-title">Affected Vulnerable Groups</div>
                  {Object.entries(CATEGORY_META).map(([key, meta]) => {
                    const cat = detailRequest.categories[key]
                    if (!cat || (!cat.count && !cat.needs)) return null
                    const Icon = meta.icon
                    return (
                      <div key={key} className="requests-detail-category">
                        <div className="requests-detail-category-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon size={14} />
                            <span>{meta.label}</span>
                          </span>
                          {cat.count > 0 && <span className="requests-detail-count">×{cat.count}</span>}
                        </div>
                        {cat.needs && <div className="requests-detail-needs">{cat.needs}</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              {detailRequest.description && (
                <div className="requests-detail-section requests-detail-notes">
                  <div className="requests-detail-section-title">Additional Notes</div>
                  <p>{detailRequest.description}</p>
                </div>
              )}

              {isAdmin && (
                <RequestMiniMap
                  request={detailRequest}
                  onOpenMap={(target) => {
                    navigate('/map', {
                      state: {
                        focusRequestId: target.docId,
                        focusLat: target.lat,
                        focusLng: target.lng,
                        focusName: target.requesterName,
                        focusLocation: target.location,
                        status: target.status,
                      },
                    })
                  }}
                />
              )}
            </div>
            <div className="requests-detail-footer">
              {isAdmin ? (
                <select
                  className="requests-status-select"
                  value={detailRequest.status}
                  disabled={updatingId === detailRequest.docId}
                  onChange={(e) => handleStatusChange(detailRequest.docId, e.target.value)}
                  aria-label="Change request status"
                >
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              ) : (
                <span className={`dashboard-status ${getStatusClass(detailRequest.status)}`}>
                  {getStatusLabel(detailRequest.status)}
                </span>
              )}
              <button
                type="button"
                className="requests-delete-btn"
                disabled={updatingId === detailRequest.docId}
                onClick={() => handleDelete(detailRequest.docId)}
                title="Delete this request"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="requests-modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="requests-modal requests-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="requests-modal-header">
              <h3>New Relief Request</h3>
              <p>Enter the details of the affected family or individual in your community.</p>
            </div>
            <form onSubmit={handleCreate}>
              {error && <div className="requests-error" style={{ marginBottom: '16px' }}>{error}</div>}
              {/* Head of Family & Family Members */}
              <div className="requests-form-grid">
                <div className="requests-form-field">
                  <label htmlFor="rr-name">Name of Person / Family Representative</label>
                  <input
                    id="rr-name"
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    value={form.requesterName}
                    onChange={(e) => setForm((f) => ({ ...f, requesterName: e.target.value }))}
                    disabled={saving}
                    required
                  />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="rr-family">Number of Family Members</label>
                  <input
                    id="rr-family"
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={form.familyMembers}
                    onChange={(e) => setForm((f) => ({ ...f, familyMembers: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Contact Number */}
              <div className="requests-form-field">
                <label htmlFor="rr-contact">Contact Number</label>
                <input
                  id="rr-contact"
                  type="tel"
                  placeholder="e.g. 0917-123-4567"
                  value={form.contactNumber}
                  onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                  disabled={saving}
                />
              </div>

              {/* Location / Address */}
              <div className="requests-form-field">
                <label htmlFor="rr-location">Location / Address</label>
                <div className="requests-location-row">
                  <LocationAutocomplete
                    id="rr-location"
                    value={form.location}
                    onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                    onCoordChange={(c) => setForm((f) => ({ ...f, lat: c.lat, lng: c.lng }))}
                    disabled={saving}
                    placeholder="e.g. Barangay Mabolo, Naga City"
                  />
                  <button
                    type="button"
                    className="requests-locate-btn"
                    onClick={detectLocation}
                    disabled={saving || locating}
                    title="Use my current GPS location"
                  >
                    {locating ? <Loader2 size={16} className="spin-icon" /> : <MapPin size={16} />}
                  </button>
                </div>
              </div>

              {/* Most Needed Relief Items (Multiple Choice) */}
              <div className="requests-form-field">
                <label>
                  Most Needed Relief Items
                  <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B', marginLeft: '6px' }}>
                    (Choose all that apply)
                  </span>
                </label>
                <div className="requests-needs-multiselect">
                  {PRIMARY_NEED_OPTIONS.map((opt) => {
                    const isSelected = (form.primaryNeeds || []).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`requests-need-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => togglePrimaryNeed(opt)}
                        disabled={saving}
                      >
                        <span className="need-btn-check">{isSelected ? '✓' : '+'}</span>
                        <span>{opt}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* PWD Assistive Device */}
              <div className="requests-form-field">
                <label htmlFor="rr-assistive">PWD Assistive Device</label>
                <select
                  id="rr-assistive"
                  className="requests-form-select"
                  value={form.assistiveDevice}
                  onChange={(e) => setForm((f) => ({ ...f, assistiveDevice: e.target.value }))}
                  disabled={saving}
                >
                  <option value="">None / Not needed</option>
                  {ASSISTIVE_DEVICE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Housing & Damage Classification */}
              <div className="requests-form-grid">
                <div className="requests-form-field">
                  <label htmlFor="rr-ownership">House Ownership</label>
                  <select
                    id="rr-ownership"
                    className="requests-form-select"
                    value={form.houseOwnership}
                    onChange={(e) => setForm((f) => ({ ...f, houseOwnership: e.target.value }))}
                    disabled={saving}
                  >
                    {HOUSE_OWNERSHIP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="requests-form-field">
                  <label htmlFor="rr-damage">Shelter Damage Classification</label>
                  <select
                    id="rr-damage"
                    className="requests-form-select"
                    value={form.shelterDamage}
                    onChange={(e) => setForm((f) => ({ ...f, shelterDamage: e.target.value }))}
                    disabled={saving}
                  >
                    {SHELTER_DAMAGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4Ps Beneficiary & Evacuation Center */}
              <div className="requests-form-grid" style={{ alignItems: 'center' }}>
                <div className="requests-form-field">
                  <label>Special Classification</label>
                  <label className="requests-checkbox" style={{ marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      checked={form.is4PsBeneficiary}
                      onChange={(e) => setForm((f) => ({ ...f, is4PsBeneficiary: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>4Ps Beneficiary (Pantawid Pamilya)</span>
                  </label>
                </div>
                <div className="requests-form-field">
                  <label>Evacuation Center in Barangay?</label>
                  <div className="requests-radio-group">
                    <label className="requests-radio">
                      <input
                        type="radio"
                        name="form-evac"
                        checked={form.hasEvacuationCenter === true}
                        onChange={() => setForm((f) => ({ ...f, hasEvacuationCenter: true }))}
                        disabled={saving}
                      />
                      <span>Yes, inside center</span>
                    </label>
                    <label className="requests-radio">
                      <input
                        type="radio"
                        name="form-evac"
                        checked={form.hasEvacuationCenter === false}
                        onChange={() => setForm((f) => ({ ...f, hasEvacuationCenter: false }))}
                        disabled={saving}
                      />
                      <span>No, at home</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="requests-section-header-row">
                <div className="requests-section-label">Affected Vulnerable Groups</div>
                {hasFamilyLimit && (
                  <span className={`vuln-counter-badge ${isFormExceeded ? 'exceeded' : 'neutral'}`}>
                    {isFormExceeded
                      ? `⚠️ Exceeds limit (${totalVulnCount} / ${modalFamilyCount})`
                      : `${totalVulnCount} / ${modalFamilyCount} allocated`}
                  </span>
                )}
              </div>

              <div className="requests-category-grid">
                {Object.entries(CATEGORY_META).map(([key, meta]) => {
                  const Icon = meta.icon
                  const catCount = parseInt(form.categories[key]?.count, 10) || 0
                  const isIndividualExceeded = hasFamilyLimit && catCount > modalFamilyCount
                  const isCardExceeded = isIndividualExceeded || (isTotalExceeded && catCount > 0)
                  return (
                    <div key={key} className={`requests-category-card ${key}`}>
                      <div className="requests-category-card-header">
                        <Icon size={16} />
                        <span>{meta.label}</span>
                      </div>
                      <div className="requests-category-card-fields">
                        <div className="requests-form-field compact">
                          <label htmlFor={`fc-${key}`}>
                            Count
                            {hasFamilyLimit && (
                              <span style={{ fontSize: '11px', color: isCardExceeded ? '#DC2626' : '#718096', marginLeft: '6px', fontWeight: 'normal' }}>
                                (Max {modalFamilyCount})
                              </span>
                            )}
                          </label>
                          <input
                            id={`fc-${key}`}
                            type="number"
                            min="0"
                            max={hasFamilyLimit ? modalFamilyCount : undefined}
                            className={isCardExceeded ? 'input-exceeded' : ''}
                            placeholder="0"
                            value={form.categories[key].count}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                categories: {
                                  ...f.categories,
                                  [key]: { ...f.categories[key], count: e.target.value },
                                },
                              }))
                            }
                            disabled={saving}
                          />
                          {isIndividualExceeded && (
                            <span className="requests-count-error">
                              Exceeds family limit of {modalFamilyCount}
                            </span>
                          )}
                          {!isIndividualExceeded && isTotalExceeded && catCount > 0 && (
                            <span className="requests-count-error">
                              Total count ({totalVulnCount}) exceeds limit ({modalFamilyCount})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="requests-form-field">
                <label htmlFor="rr-notes">Additional Situation Notes (Optional)</label>
                <textarea
                  id="rr-notes"
                  placeholder="Provide any additional emergency or relief details..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="requests-modal-actions">
                <button type="button" className="requests-btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="requests-btn-primary"
                  disabled={saving || isFormExceeded}
                  title={isFormExceeded ? `Counts exceed family members limit (${modalFamilyCount})` : ''}
                >
                  <Plus size={16} />
                  <span>{saving ? 'Creating Request...' : 'Create Relief Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
