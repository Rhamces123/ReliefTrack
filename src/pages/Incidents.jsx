import { useEffect, useState, useMemo } from 'react'
import {
  Siren,
  AlertTriangle,
  Flame,
  CloudRain,
  Waves,
  Mountain,
  Zap,
  Building2,
  Users,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  AlertOctagon,
  Info,
  X,
  FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createDisasterIncident,
  subscribeDisasterIncidents,
  updateDisasterIncident,
  deleteDisasterIncident,
  DISASTER_TYPES,
  SEVERITY_LEVELS,
  INCIDENT_STATUSES,
  NAGA_BARANGAYS_LIST,
} from '../firebase/incidents'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Incidents.css'

function DisasterIcon({ type, size = 16, className = '' }) {
  switch (type) {
    case 'Typhoon':
    case 'Severe Weather':
      return <CloudRain size={size} className={className} />
    case 'Flood':
      return <Waves size={size} className={className} />
    case 'Landslide':
      return <Mountain size={size} className={className} />
    case 'Fire':
      return <Flame size={size} className={className} />
    case 'Earthquake':
      return <Zap size={size} className={className} />
    case 'Storm Surge':
      return <Waves size={size} className={className} />
    default:
      return <AlertTriangle size={size} className={className} />
  }
}

const DEFAULT_INCIDENT_FORM = {
  title: '',
  disasterType: 'Typhoon',
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
  severity: 'Critical',
  status: 'Active',
  affectedBarangays: [],
  casualties: 0,
  injured: 0,
  missing: 0,
  displacedFamilies: 0,
  displacedIndividuals: 0,
  evacuationCentersActive: 0,
  description: '',
  immediateNeeds: '',
}

export default function Incidents() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [severityFilter, setSeverityFilter] = useState('All')

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingIncident, setEditingIncident] = useState(null)
  const [form, setForm] = useState(DEFAULT_INCIDENT_FORM)
  const [saving, setSaving] = useState(false)

  // Details Modal
  const [selectedIncident, setSelectedIncident] = useState(null)

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    const unsub = subscribeDisasterIncidents(
      (data) => {
        setIncidents(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching disaster incidents:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        (inc.title || '').toLowerCase().includes(q) ||
        (inc.incidentId || '').toLowerCase().includes(q) ||
        (inc.description || '').toLowerCase().includes(q) ||
        (inc.affectedBarangays || []).some((b) => b.toLowerCase().includes(q))

      const matchType = typeFilter === 'All' || inc.disasterType === typeFilter
      const matchStatus = statusFilter === 'All' || inc.status === statusFilter
      const matchSeverity = severityFilter === 'All' || inc.severity === severityFilter

      return matchSearch && matchType && matchStatus && matchSeverity
    })
  }, [incidents, search, typeFilter, statusFilter, severityFilter])

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = incidents.length
    const active = incidents.filter((i) => i.status === 'Active').length
    const displacedFamilies = incidents.reduce((s, i) => s + (Number(i.displacedFamilies) || 0), 0)
    const totalCasualties = incidents.reduce((s, i) => s + (Number(i.casualties) || 0), 0)
    const totalInjured = incidents.reduce((s, i) => s + (Number(i.injured) || 0), 0)
    const affectedBrgysSet = new Set()
    incidents.forEach((i) => (i.affectedBarangays || []).forEach((b) => affectedBrgysSet.add(b)))

    return {
      total,
      active,
      displacedFamilies,
      totalCasualties,
      totalInjured,
      affectedBrgysCount: affectedBrgysSet.size,
    }
  }, [incidents])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingIncident(null)
    setForm(DEFAULT_INCIDENT_FORM)
    setShowModal(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (incident) => {
    setEditingIncident(incident)
    setForm({
      title: incident.title || '',
      disasterType: incident.disasterType || 'Typhoon',
      incidentDate: incident.incidentDate || '',
      incidentTime: incident.incidentTime || '',
      severity: incident.severity || 'Critical',
      status: incident.status || 'Active',
      affectedBarangays: incident.affectedBarangays || [],
      casualties: incident.casualties ?? 0,
      injured: incident.injured ?? 0,
      missing: incident.missing ?? 0,
      displacedFamilies: incident.displacedFamilies ?? 0,
      displacedIndividuals: incident.displacedIndividuals ?? 0,
      evacuationCentersActive: incident.evacuationCentersActive ?? 0,
      description: incident.description || '',
      immediateNeeds: incident.immediateNeeds || '',
    })
    setShowModal(true)
  }

  // Toggle Barangay Checkbox in Form
  const handleToggleBarangay = (brgy) => {
    setForm((prev) => {
      const exists = prev.affectedBarangays.includes(brgy)
      if (exists) {
        return { ...prev, affectedBarangays: prev.affectedBarangays.filter((b) => b !== brgy) }
      } else {
        return { ...prev, affectedBarangays: [...prev.affectedBarangays, brgy] }
      }
    })
  }

  // Submit Create or Edit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.affectedBarangays.length === 0) {
      alert('Please select at least one affected barangay in City of Naga.')
      return
    }

    const resolvedTitle =
      form.title?.trim() ||
      `${form.disasterType} Incident`

    const payload = {
      ...form,
      title: resolvedTitle,
    }

    setSaving(true)
    try {
      if (editingIncident) {
        await updateDisasterIncident(editingIncident.docId, payload)
      } else {
        await createDisasterIncident(payload, user)
      }
      setShowModal(false)
      setEditingIncident(null)
    } catch (err) {
      console.error('Error saving incident:', err)
      alert('Failed to save disaster incident. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Quick Status Change
  const handleQuickStatusChange = async (incident, nextStatus) => {
    try {
      await updateDisasterIncident(incident.docId, { status: nextStatus })
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  // Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget?.docId) return
    setDeleting(true)
    try {
      await deleteDisasterIncident(deleteTarget.docId)
      setIncidents((prev) => prev.filter((i) => i.docId !== deleteTarget.docId))
      setDeleteTarget(null)
      if (selectedIncident?.docId === deleteTarget.docId) {
        setSelectedIncident(null)
      }
    } catch (err) {
      console.error('Error deleting incident:', err)
      alert(`Failed to delete incident: ${err.message || 'Please try again.'}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout
      title="Disaster Incident Recording"
      userLabel={profile?.displayName || user?.displayName || 'User'}
      userEmail={user?.email}
    >
      <div className="incidents-container">
        {/* Header Bar */}
        <div className="incidents-header">
          <div className="incidents-header-text">
            <h2>Disaster Incident Recording</h2>
            <p>
              Log calamity events, record affected barangays, track casualty and displacement counts,
              and coordinate emergency relief priorities.
            </p>
          </div>
          <button
            type="button"
            className="btn-record-incident"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Record Disaster Incident</span>
          </button>
        </div>

        {/* Top Metric Cards */}
        <div className="incidents-stats-grid">
          <div className="incident-stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">TOTAL INCIDENTS</span>
              <span className="stat-icon-wrap blue"><FileText size={18} /></span>
            </div>
            <div className="stat-card-value">{loading ? '—' : metrics.total}</div>
            <div className="stat-card-sub">Recorded in City of Naga</div>
          </div>

          <div className="incident-stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">ACTIVE OPERATIONS</span>
              <span className="stat-icon-wrap red"><Siren size={18} /></span>
            </div>
            <div className="stat-card-value text-red">{loading ? '—' : metrics.active}</div>
            <div className="stat-card-sub">Ongoing emergency relief</div>
          </div>

          <div className="incident-stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">AFFECTED BARANGAYS</span>
              <span className="stat-icon-wrap amber"><MapPin size={18} /></span>
            </div>
            <div className="stat-card-value">{loading ? '—' : metrics.affectedBrgysCount}</div>
            <div className="stat-card-sub">Areas reporting damage</div>
          </div>

          <div className="incident-stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">DISPLACED FAMILIES</span>
              <span className="stat-icon-wrap green"><Users size={18} /></span>
            </div>
            <div className="stat-card-value">{loading ? '—' : metrics.displacedFamilies}</div>
            <div className="stat-card-sub">
              {metrics.totalCasualties > 0
                ? `${metrics.totalCasualties} casualties • ${metrics.totalInjured} injured`
                : `${metrics.totalInjured} injured reported`}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="incidents-toolbar">
          <div className="incident-search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by calamity name, barangay, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="incident-filter-group">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by disaster type"
            >
              <option value="All">All Disaster Types</option>
              {DISASTER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter by severity"
            >
              <option value="All">All Severities</option>
              {SEVERITY_LEVELS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Incidents Cards List */}
        {loading ? (
          <div className="incidents-empty">Loading recorded disaster incidents...</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="incidents-empty">
            <AlertOctagon size={42} className="empty-icon" />
            <h3>No Disaster Incidents Found</h3>
            <p>
              {search || typeFilter !== 'All' || statusFilter !== 'All' || severityFilter !== 'All'
                ? 'No incidents match your selected filters. Try clearing search or filters.'
                : 'No incidents recorded yet. Click "+ Record Disaster Incident" to log a new event.'}
            </p>
          </div>
        ) : (
          <div className="incidents-cards-grid">
            {filteredIncidents.map((incident) => {
              const isCritical = incident.severity === 'Critical'
              const isSevere = incident.severity === 'Severe'
              const isActive = incident.status === 'Active'

              return (
                <div
                  key={incident.docId}
                  className={`incident-card ${isCritical ? 'border-critical' : isSevere ? 'border-severe' : ''}`}
                >
                  <div className="incident-card-header">
                    <div className="incident-title-block">
                      <div className="incident-type-tag">
                        <DisasterIcon type={incident.disasterType} size={15} />
                        <span>{incident.disasterType}</span>
                      </div>
                      <span className="incident-id-text">{incident.incidentId}</span>
                    </div>

                    <div className="incident-badges">
                      <span className={`severity-badge severity-${(incident.severity || 'moderate').toLowerCase()}`}>
                        {incident.severity}
                      </span>
                      <span className={`status-badge status-${(incident.status || 'active').toLowerCase()}`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>

                  <h3
                    className="incident-title"
                    onClick={() => setSelectedIncident(incident)}
                    title="Click to view full incident details"
                  >
                    {incident.title}
                  </h3>

                  <div className="incident-date-row">
                    <Calendar size={13} />
                    <span>{incident.incidentDate || 'Recent'}</span>
                    {incident.incidentTime && (
                      <>
                        <Clock size={13} style={{ marginLeft: 8 }} />
                        <span>{incident.incidentTime}</span>
                      </>
                    )}
                  </div>

                  {/* Affected Barangays */}
                  <div className="incident-brgys-row">
                    <span className="brgy-label">
                      <MapPin size={13} /> Affected:
                    </span>
                    <div className="brgy-pills-wrap">
                      {(incident.affectedBarangays || []).map((b) => (
                        <span key={b} className="brgy-pill">{b}</span>
                      ))}
                    </div>
                  </div>

                  {/* Impact Counters */}
                  <div className="incident-metrics-grid">
                    <div className="metric-box">
                      <span className="metric-box-val">{incident.displacedFamilies ?? 0}</span>
                      <span className="metric-box-lbl">Displaced Families</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-box-val">{incident.displacedIndividuals ?? 0}</span>
                      <span className="metric-box-lbl">Individuals</span>
                    </div>
                    <div className="metric-box">
                      <span className={`metric-box-val ${(incident.casualties || 0) > 0 ? 'text-red' : ''}`}>
                        {incident.casualties ?? 0}
                      </span>
                      <span className="metric-box-lbl">Casualties</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-box-val">{incident.injured ?? 0}</span>
                      <span className="metric-box-lbl">Injured</span>
                    </div>
                  </div>

                  {/* Short Description */}
                  {incident.description && (
                    <p className="incident-snippet">
                      {incident.description}
                    </p>
                  )}

                  {/* Card Actions Footer */}
                  <div className="incident-card-footer">
                    <div className="quick-status-actions">
                      {incident.status === 'Active' && (
                        <button
                          type="button"
                          className="btn-status-quick contained"
                          onClick={() => handleQuickStatusChange(incident, 'Contained')}
                          title="Mark incident as contained"
                        >
                          Mark Contained
                        </button>
                      )}
                      {incident.status === 'Contained' && (
                        <button
                          type="button"
                          className="btn-status-quick resolved"
                          onClick={() => handleQuickStatusChange(incident, 'Resolved')}
                          title="Mark incident as resolved"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {incident.status === 'Resolved' && (
                        <button
                          type="button"
                          className="btn-status-quick active"
                          onClick={() => handleQuickStatusChange(incident, 'Active')}
                          title="Reopen incident as active"
                        >
                          Reopen Operation
                        </button>
                      )}
                    </div>

                    <div className="crud-actions">
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => setSelectedIncident(incident)}
                        title="View details"
                      >
                        <Info size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => handleOpenEdit(incident)}
                        title="Edit incident"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-action-icon delete"
                        onClick={() => setDeleteTarget(incident)}
                        title="Delete incident record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal: Record or Edit Incident */}
        {showModal && (
          <div className="incident-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="incident-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="incident-modal-header">
                <div className="modal-title-wrap">
                  <DisasterIcon type={form.disasterType} size={22} className="text-primary" />
                  <div>
                    <h3>{editingIncident ? 'Edit Disaster Incident' : 'Record Disaster Incident'}</h3>
                    <p>Enter the calamity details, affected Naga City barangays, and initial casualty/damage report.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="incident-form">
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Disaster Type *</label>
                    <select
                      value={form.disasterType}
                      onChange={(e) => setForm({ ...form, disasterType: e.target.value })}
                    >
                      {DISASTER_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Severity Level</label>
                    <select
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    >
                      {SEVERITY_LEVELS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Operational Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      {INCIDENT_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Date of Incident *</label>
                    <input
                      type="date"
                      value={form.incidentDate}
                      onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Time of Incident</label>
                    <input
                      type="time"
                      value={form.incidentTime}
                      onChange={(e) => setForm({ ...form, incidentTime: e.target.value })}
                    />
                  </div>
                </div>

                {/* Affected Barangays Selector */}
                <div className="form-group">
                  <div className="barangay-select-header">
                    <label>Affected Barangays in City of Naga ({form.affectedBarangays.length} selected) *</label>
                    <div className="select-all-actions">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, affectedBarangays: [...NAGA_BARANGAYS_LIST] })}
                      >
                        Select All 28
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, affectedBarangays: [] })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="barangay-checkbox-grid">
                    {NAGA_BARANGAYS_LIST.map((brgy) => {
                      const isChecked = form.affectedBarangays.includes(brgy)
                      return (
                        <label
                          key={brgy}
                          className={`brgy-check-label ${isChecked ? 'checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBarangay(brgy)}
                          />
                          <span>{brgy}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Casualties & Displacement Counts */}
                <div className="form-section-label">Casualty & Displacement Assessment</div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Displaced Families</label>
                    <input
                      type="number"
                      min="0"
                      value={form.displacedFamilies}
                      onChange={(e) => setForm({ ...form, displacedFamilies: e.target.value })}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Displaced Individuals</label>
                    <input
                      type="number"
                      min="0"
                      value={form.displacedIndividuals}
                      onChange={(e) => setForm({ ...form, displacedIndividuals: e.target.value })}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Casualties (Deaths)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.casualties}
                      onChange={(e) => setForm({ ...form, casualties: e.target.value })}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Injured</label>
                    <input
                      type="number"
                      min="0"
                      value={form.injured}
                      onChange={(e) => setForm({ ...form, injured: e.target.value })}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Active Evac Centers</label>
                    <input
                      type="number"
                      min="0"
                      value={form.evacuationCentersActive}
                      onChange={(e) => setForm({ ...form, evacuationCentersActive: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Operational Situation Description</label>
                  <textarea
                    rows="3"
                    placeholder="Provide overview of damage, water levels, road blockages, landslide risks, or infrastructure disruption..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Immediate Relief Supplies & Operations Needed</label>
                  <input
                    type="text"
                    placeholder="e.g. 500 Food packs, 200 water gallons, hygiene kits, rescue boats, emergency power generator"
                    value={form.immediateNeeds}
                    onChange={(e) => setForm({ ...form, immediateNeeds: e.target.value })}
                  />
                </div>

                <div className="incident-form-footer">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-save-incident"
                    disabled={saving}
                  >
                    {saving ? 'Saving Incident...' : editingIncident ? 'Update Incident Record' : 'Save Disaster Incident'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Incident Details View */}
        {selectedIncident && (
          <div className="incident-modal-overlay" onClick={() => setSelectedIncident(null)}>
            <div className="incident-modal-content details-view" onClick={(e) => e.stopPropagation()}>
              <div className="incident-modal-header">
                <div className="modal-title-wrap">
                  <DisasterIcon type={selectedIncident.disasterType} size={24} className="text-primary" />
                  <div>
                    <h3>{selectedIncident.title}</h3>
                    <p>
                      <strong>{selectedIncident.incidentId}</strong> • Logged by {selectedIncident.createdByName || 'Staff'} on{' '}
                      {selectedIncident.incidentDate} {selectedIncident.incidentTime || ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedIncident(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="incident-details-body">
                <div className="details-tags-row">
                  <span className={`severity-badge severity-${(selectedIncident.severity || 'moderate').toLowerCase()}`}>
                    Severity: {selectedIncident.severity}
                  </span>
                  <span className={`status-badge status-${(selectedIncident.status || 'active').toLowerCase()}`}>
                    Status: {selectedIncident.status}
                  </span>
                  <span className="type-badge">
                    Type: {selectedIncident.disasterType}
                  </span>
                </div>

                <div className="details-impact-grid">
                  <div className="impact-box">
                    <span className="impact-number">{selectedIncident.displacedFamilies ?? 0}</span>
                    <span className="impact-label">Displaced Families</span>
                  </div>
                  <div className="impact-box">
                    <span className="impact-number">{selectedIncident.displacedIndividuals ?? 0}</span>
                    <span className="impact-label">Displaced Individuals</span>
                  </div>
                  <div className="impact-box">
                    <span className={`impact-number ${(selectedIncident.casualties || 0) > 0 ? 'text-red' : ''}`}>
                      {selectedIncident.casualties ?? 0}
                    </span>
                    <span className="impact-label">Casualties</span>
                  </div>
                  <div className="impact-box">
                    <span className="impact-number">{selectedIncident.injured ?? 0}</span>
                    <span className="impact-label">Injured</span>
                  </div>
                  <div className="impact-box">
                    <span className="impact-number">{selectedIncident.evacuationCentersActive ?? 0}</span>
                    <span className="impact-label">Active Evac Centers</span>
                  </div>
                </div>

                <div className="details-section">
                  <h4>📍 Affected Naga City Barangays ({(selectedIncident.affectedBarangays || []).length})</h4>
                  <div className="brgy-pills-wrap large">
                    {(selectedIncident.affectedBarangays || []).map((b) => (
                      <span key={b} className="brgy-pill">{b}</span>
                    ))}
                  </div>
                </div>

                {selectedIncident.description && (
                  <div className="details-section">
                    <h4>📋 Operational Situation & Damage Overview</h4>
                    <p className="details-text">{selectedIncident.description}</p>
                  </div>
                )}

                {selectedIncident.immediateNeeds && (
                  <div className="details-section">
                    <h4>📦 Immediate Relief Aid Needed</h4>
                    <div className="needs-box">{selectedIncident.immediateNeeds}</div>
                  </div>
                )}

                <div className="details-footer-actions">
                  <button
                    type="button"
                    className="btn-action-icon delete"
                    style={{ width: 'auto', padding: '8px 14px', gap: '6px' }}
                    onClick={() => {
                      const target = selectedIncident
                      setSelectedIncident(null)
                      setDeleteTarget(target)
                    }}
                    title="Delete this incident"
                  >
                    <Trash2 size={15} /> <span>Delete Incident</span>
                  </button>
                  <button
                    type="button"
                    className="btn-edit-secondary"
                    onClick={() => {
                      const inc = selectedIncident
                      setSelectedIncident(null)
                      handleOpenEdit(inc)
                    }}
                  >
                    <Pencil size={15} /> <span>Edit Incident</span>
                  </button>
                  <button
                    type="button"
                    className="btn-close-view"
                    onClick={() => setSelectedIncident(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="incident-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
            <div className="incident-modal-content delete-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="delete-icon-wrap">
                <AlertTriangle size={32} />
              </div>
              <h3>Delete Disaster Incident?</h3>
              <p>
                Are you sure you want to remove <strong>{deleteTarget.title}</strong> ({deleteTarget.incidentId})? This action cannot be undone.
              </p>
              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting Incident...' : 'Yes, Delete Incident'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
