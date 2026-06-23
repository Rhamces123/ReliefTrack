import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createReliefRequest,
  subscribeReliefRequests,
  updateReliefRequestStatus,
  deleteReliefRequest,
  REQUEST_STATUSES,
  CATEGORY_LABELS,
} from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import LocationAutocomplete from '../components/LocationAutocomplete'
import {
  formatRequestDate,
  getStatusLabel,
  getStatusClass,
} from '../utils/requestHelpers'
import '../styles/Requests.css'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

const CATEGORY_ICONS = {
  pregnantWomen: '🤰',
  elders: '👴',
  pwd: '♿',
  childrenBelow7: '👶',
}

const EMPTY_FORM = {
  requesterName: '',
  location: '',
  lat: null,
  lng: null,
  familyMembers: '',
  hasEvacuationCenter: false,
  description: '',
  categories: {
    pregnantWomen: { count: '', needs: '' },
    elders: { count: '', needs: '' },
    pwd: { count: '', needs: '' },
    childrenBelow7: { count: '', needs: '' },
  },
}

function totalAffected(categories) {
  if (!categories) return 0
  return Object.values(categories).reduce((sum, c) => sum + (Number(c.count) || 0), 0)
}

export default function Requests() {
  const { user } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [detailRequest, setDetailRequest] = useState(null)

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowForm(true)
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

  const stats = useMemo(() => {
    const total = requests.length
    const totalPeople = requests.reduce((sum, r) => sum + totalAffected(r.categories), 0)
    const totalFamilies = requests.reduce((sum, r) => sum + (Number(r.familyMembers) || 0), 0)
    const withEvac = requests.filter((r) => r.hasEvacuationCenter).length
    const pending = requests.filter((r) => r.status === 'pending').length
    return { total, totalPeople, totalFamilies, withEvac, pending }
  }, [requests])

  const openForm = () => {
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.location.trim()) return
    setSaving(true)
    setError('')
    try {
      await createReliefRequest(
        { location: form.location, description: form.description, requesterName: form.requesterName, familyMembers: form.familyMembers, hasEvacuationCenter: form.hasEvacuationCenter, categories: form.categories, lat: form.lat, lng: form.lng },
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

  return (
    <DashboardLayout title="Requests" userLabel={displayName} userEmail={email}>
      <div className="requests-header">
        <div className="requests-header-text">
          <h2>Relief requests</h2>
          <p>Create and manage aid requests across barangays.</p>
        </div>
        <button type="button" className="requests-btn-primary" onClick={openForm}>
          + New Request
        </button>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && (
        <div className="requests-summary">
          <div className="requests-summary-card">
            <span className="requests-summary-icon">📋</span>
            <div>
              <div className="requests-summary-value">{stats.total}</div>
              <div className="requests-summary-label">Total Requests</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <span className="requests-summary-icon">👥</span>
            <div>
              <div className="requests-summary-value">{stats.totalPeople}</div>
              <div className="requests-summary-label">Affected Individuals</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <span className="requests-summary-icon">👪</span>
            <div>
              <div className="requests-summary-value">{stats.totalFamilies}</div>
              <div className="requests-summary-label">Family Members</div>
            </div>
          </div>
          <div className="requests-summary-card">
            <span className="requests-summary-icon">🏠</span>
            <div>
              <div className="requests-summary-value">{stats.withEvac}</div>
              <div className="requests-summary-label">In Evacuation Centers</div>
            </div>
          </div>
          <div className="requests-summary-card pending">
            <span className="requests-summary-icon">⏳</span>
            <div>
              <div className="requests-summary-value">{stats.pending}</div>
              <div className="requests-summary-label">Pending</div>
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
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`requests-filter-tab cat ${categoryFilter === key ? 'active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
            >
              {CATEGORY_ICONS[key]} {label}
            </button>
          ))}
        </div>
        <div className="requests-search-wrap">
          <span className="requests-search-icon">🔍</span>
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
          <p className="requests-loading">Loading requests...</p>
        ) : error ? (
          <p className="dashboard-empty">
            Unable to load requests. Check Firestore rules and try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className="dashboard-empty">
            {requests.length === 0
              ? 'No relief requests yet. Create your first request.'
              : 'No requests match your filters.'}
          </p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Family</th>
                <th>Evac</th>
                <th>Groups</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const catEntries = row.categories ? Object.entries(row.categories).filter(([, v]) => v.count || v.needs) : []
                const total = totalAffected(row.categories)
                return (
                  <tr
                    key={row.docId}
                    className="requests-row-clickable"
                    onClick={() => setDetailRequest(row)}
                  >
                    <td className="requests-id-cell">{row.requestId}</td>
                    <td><span className="requests-name-cell">{row.requesterName || '—'}</span></td>
                    <td className="requests-loc-cell">{row.location}</td>
                    <td>{row.familyMembers || '—'}</td>
                    <td>{row.hasEvacuationCenter ? '✅' : '❌'}</td>
                    <td>
                      {catEntries.length > 0 ? (
                        <div className="requests-cat-chips">
                          {catEntries.map(([key]) => (
                            <span key={key} className={`requests-cat-chip ${key}`}>
                              {CATEGORY_ICONS[key]} {CATEGORY_LABELS[key]}
                            </span>
                          ))}
                          {total > 0 && <span className="requests-cat-total">×{total}</span>}
                        </div>
                      ) : (
                        <span className="requests-muted">—</span>
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
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailRequest && (
        <div className="requests-overlay" onClick={() => setDetailRequest(null)}>
          <aside className="requests-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="requests-detail-header">
              <h3>{detailRequest.requesterName || 'Unnamed'}</h3>
              <button type="button" className="requests-detail-close" onClick={() => setDetailRequest(null)}>✕</button>
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
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Family Members</span>
                  <span className="requests-detail-value">{detailRequest.familyMembers || '—'}</span>
                </div>
                <div className="requests-detail-row">
                  <span className="requests-detail-label">Evacuation Center</span>
                  <span className="requests-detail-value">{detailRequest.hasEvacuationCenter ? 'Yes ✅' : 'No ❌'}</span>
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
                  <div className="requests-detail-section-title">Affected Groups & Needs</div>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                    const cat = detailRequest.categories[key]
                    if (!cat || (!cat.count && !cat.needs)) return null
                    return (
                      <div key={key} className="requests-detail-category">
                        <div className="requests-detail-category-header">
                          <span>{CATEGORY_ICONS[key]} {label}</span>
                          {cat.count > 0 && <span className="requests-detail-count">×{cat.count}</span>}
                        </div>
                        {cat.needs && <div className="requests-detail-needs">{cat.needs}</div>}
                      </div>
                    )
                  })}
                  {detailRequest.description && (
                    <div className="requests-detail-notes">
                      <div className="requests-detail-section-title">Additional Notes</div>
                      <p>{detailRequest.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="requests-detail-footer">
              {isAdmin ? (
                <select
                  className="requests-status-select"
                  value={detailRequest.status}
                  disabled={updatingId === detailRequest.docId}
                  onChange={(e) => handleStatusChange(detailRequest.docId, e.target.value)}
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
              >
                Delete
              </button>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="requests-modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="requests-modal requests-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="requests-modal-header">
              <h3>📝 New Relief Request</h3>
              <p>Enter the details of the affected family or individual.</p>
            </div>
            <form onSubmit={handleCreate}>
              <div className="requests-form-grid">
                <div className="requests-form-field">
                  <label htmlFor="rr-name">👤 Name of person / family</label>
                  <input
                    id="rr-name"
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    value={form.requesterName}
                    onChange={(e) => setForm((f) => ({ ...f, requesterName: e.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="rr-family">👪 Number of family members</label>
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
                <div className="requests-form-field">
                  <label htmlFor="rr-location">📍 Location</label>
                  <LocationAutocomplete
                    id="rr-location"
                    value={form.location}
                    onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                    onCoordChange={(c) => setForm((f) => ({ ...f, lat: c.lat, lng: c.lng }))}
                    disabled={saving}
                    placeholder="e.g. Barangay Mabolo, Naga City"
                  />
                </div>
              </div>

              <div className="requests-form-field">
                <label>🏠 Has evacuation center in barangay?</label>
                <div className="requests-radio-group">
                  <label className="requests-radio">
                    <input
                      type="radio"
                      name="form-evac"
                      checked={form.hasEvacuationCenter === true}
                      onChange={() => setForm((f) => ({ ...f, hasEvacuationCenter: true }))}
                      disabled={saving}
                    />
                    Yes
                  </label>
                  <label className="requests-radio">
                    <input
                      type="radio"
                      name="form-evac"
                      checked={form.hasEvacuationCenter === false}
                      onChange={() => setForm((f) => ({ ...f, hasEvacuationCenter: false }))}
                      disabled={saving}
                    />
                    No
                  </label>
                </div>
              </div>

              <div className="requests-section-label">👥 Affected groups — how many & what they need</div>
              <div className="requests-category-grid">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <div key={key} className={`requests-category-card ${key}`}>
                    <div className="requests-category-card-header">
                      {CATEGORY_ICONS[key]} {label}
                    </div>
                    <div className="requests-category-card-fields">
                      <div className="requests-form-field compact">
                        <label htmlFor={`fc-${key}`}>Count</label>
                        <input
                          id={`fc-${key}`}
                          type="number"
                          min="0"
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
                      </div>
                      <div className="requests-form-field compact">
                        <label htmlFor={`fn-${key}`}>Needs</label>
                        <input
                          id={`fn-${key}`}
                          type="text"
                          placeholder="food, water, medical..."
                          value={form.categories[key].needs}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              categories: {
                                ...f.categories,
                                [key]: { ...f.categories[key], needs: e.target.value },
                              },
                            }))
                          }
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="requests-form-field">
                <label htmlFor="rr-notes">📓 Additional notes (optional)</label>
                <textarea
                  id="rr-notes"
                  placeholder="Any other relevant information about the situation..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="requests-modal-actions">
                <button type="button" className="requests-btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="requests-btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
