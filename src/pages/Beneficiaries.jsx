import { useEffect, useState, useMemo } from 'react'
import {
  X,
  Eye,
  Users,
  User,
  Home,
  Shield,
  FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createFamily,
  subscribeFamilies,
  updateFamily,
  deleteFamily,
  CLASSIFICATIONS,
  ECONOMIC_STATUSES,
} from '../firebase/families'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Beneficiaries.css'

const EMPTY_FORM = {
  familyName: '',
  barangay: '',
  headOfFamily: '',
  contactNumber: '',
  members: '1',
  economicStatus: 'not-set',
  notes: '',
}

function getClassLabel(id) {
  return CLASSIFICATIONS.find((c) => c.id === id)?.label || id
}
function getEconLabel(id) {
  return ECONOMIC_STATUSES.find((e) => e.id === id)?.label || ''
}

function formatFamilyDate(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function Beneficiaries() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFamily, setSelectedFamily] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDocId, setEditingDocId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('all')

  const isAdmin = profile?.role === 'Admin'
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    setLoading(true)
    setError('')
    const unsub = subscribeFamilies(
      (data) => { setFamilies(data); setLoading(false); setError('') },
      (err) => { setError(err.message || 'Failed to load families.'); setLoading(false) },
      { uid: user.uid, role: profile?.role }
    )
    return unsub
  }, [user?.uid, profile?.role])

  const barangayList = useMemo(() => {
    const set = new Set(families.map((f) => f.barangay?.trim()).filter(Boolean))
    return ['all', ...[...set].sort()]
  }, [families])

  const groupedFamilies = useMemo(() => {
    let list = families
    if (barangayFilter !== 'all') {
      list = list.filter((f) => (f.barangay || '').trim() === barangayFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (f) =>
          f.familyName?.toLowerCase().includes(q) ||
          f.barangay?.toLowerCase().includes(q) ||
          f.headOfFamily?.toLowerCase().includes(q) ||
          f.householdNumber?.toLowerCase().includes(q)
      )
    }

    const map = {}
    for (const f of list) {
      const bg = f.barangay?.trim() || 'Unassigned Barangay'
      if (!map[bg]) map[bg] = []
      map[bg].push(f)
    }

    return Object.entries(map)
      .map(([barangay, items]) => ({
        barangay,
        items,
        count: items.length,
      }))
      .sort((a, b) => a.barangay.localeCompare(b.barangay))
  }, [families, barangayFilter, searchQuery])

  const totalFilteredCount = useMemo(
    () => groupedFamilies.reduce((sum, g) => sum + g.items.length, 0),
    [groupedFamilies]
  )

  const stats = useMemo(() => {
    const total = families.length
    const totalMembers = families.reduce((s, f) => s + (Number(f.members) || 0), 0)
    const barangays = new Set(families.map((f) => f.barangay?.trim()).filter(Boolean)).size
    return { total, totalMembers, barangays }
  }, [families])

  const openEditForm = (f) => {
    setEditingDocId(f.docId)
    setForm({
      familyName: f.familyName || '',
      barangay: f.barangay || '',
      headOfFamily: f.headOfFamily || '',
      contactNumber: f.contactNumber || '',
      members: String(f.members || '1'),
      economicStatus: f.economicStatus || 'not-set',
      notes: f.notes || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingDocId(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.familyName.trim() || !form.barangay.trim()) {
      setError('Family name and barangay are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingDocId) {
        await updateFamily(editingDocId, form)
      } else {
        await createFamily(form, user)
      }
      closeForm()
    } catch (err) {
      setError(err.message || 'Failed to save family.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this family record?')) return
    setActionId(docId)
    setError('')
    try {
      await deleteFamily(docId)
    } catch (err) {
      setError(err.message || 'Failed to delete.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <DashboardLayout title="Beneficiaries" userLabel={displayName} userEmail={email}>
      <div className="benef-header">
        <div className="benef-header-text">
          <h2>Family Registry</h2>
          <p>Monitor families per barangay and identify their classification.</p>
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && families.length > 0 && (
        <div className="benef-summary">
          <span className="benef-chip">Total Families: <strong>{stats.total}</strong></span>
          <span className="benef-chip">Total Members: <strong>{stats.totalMembers}</strong></span>
          <span className="benef-chip">Barangays: <strong>{stats.barangays}</strong></span>
        </div>
      )}

      <div className="benef-toolbar">
        <input
          className="benef-search"
          type="text"
          placeholder="Search family, barangay, or head..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="benef-filter"
          value={barangayFilter}
          onChange={(e) => setBarangayFilter(e.target.value)}
        >
          {barangayList.map((b) => (
            <option key={b} value={b}>{b === 'all' ? 'All Barangays' : b}</option>
          ))}
        </select>
      </div>

      <div className="dashboard-activity">
        {loading && !error ? (
          <p className="requests-loading">Loading families...</p>
        ) : error && families.length === 0 ? (
          <p className="dashboard-empty">Unable to load. Check connection and try again.</p>
        ) : totalFilteredCount === 0 ? (
          <p className="dashboard-empty">
            {families.length === 0 ? 'No families registered yet.' : 'No families match your filters.'}
          </p>
        ) : (
          <div className="benef-barangay-groups">
            {groupedFamilies.map((group) => (
              <div key={group.barangay} className="benef-barangay-group">
                <div className="benef-barangay-header">
                  <h3>📍 {group.barangay}</h3>
                  <span className="benef-barangay-count">
                    {group.items.length} {group.items.length === 1 ? 'FAMILY' : 'FAMILIES'}
                  </span>
                </div>
                <div className="benef-grid">
                  {group.items.map((f) => (
                    <div
                      key={f.docId}
                      className="benef-card"
                      onClick={() => setSelectedFamily(f)}
                      title="Click card to view full family details"
                    >
                      <div className="benef-card-header">
                        <div className="benef-card-title">
                          <h3>{f.familyName}</h3>
                          <span className={`benef-class-badge ${f.classification}`}>
                            {getClassLabel(f.classification)}
                          </span>
                          {getEconLabel(f.economicStatus) && (
                            <span className={`benef-econ-badge ${f.economicStatus}`}>
                              {getEconLabel(f.economicStatus)}
                            </span>
                          )}
                          {f.is4PsBeneficiary && (
                            <span className="benef-4ps-badge">4Ps Beneficiary</span>
                          )}
                        </div>
                        <div className="benef-card-members">{f.members} member{f.members > 1 ? 's' : ''}</div>
                      </div>
                      <div className="benef-card-body">
                        {f.householdNumber && (
                          <div className="benef-card-row">
                            <span className="benef-label">Household No.</span>
                            <span style={{ fontWeight: 600, color: '#1674D1' }}>{f.householdNumber}</span>
                          </div>
                        )}
                        <div className="benef-card-row">
                          <span className="benef-label">Barangay</span>
                          <span>{f.barangay}</span>
                        </div>
                        <div className="benef-card-row">
                          <span className="benef-label">Head of Family</span>
                          <span>{f.headOfFamily || '—'}</span>
                        </div>
                        {(f.repAge || f.repSex) && (
                          <div className="benef-card-row">
                            <span className="benef-label">Age / Sex</span>
                            <span>{[f.repAge ? `${f.repAge} yrs old` : '', f.repSex].filter(Boolean).join(' • ')}</span>
                          </div>
                        )}
                        {f.repOccupation && (
                          <div className="benef-card-row">
                            <span className="benef-label">Occupation</span>
                            <span>{f.repOccupation}</span>
                          </div>
                        )}
                        <div className="benef-card-row">
                          <span className="benef-label">Contact</span>
                          <span>{f.contactNumber || '—'}</span>
                        </div>
                        {f.familyMembersList && f.familyMembersList.length > 0 && (
                          <div className="benef-card-row">
                            <span className="benef-label">Members ({f.familyMembersList.length})</span>
                            <span title={f.familyMembersList.map((m) => `${m.name || 'Member'} (${m.relation || 'Relative'})`).join(', ')}>
                              {f.familyMembersList
                                .map((m) => m.name || m.relation)
                                .filter(Boolean)
                                .slice(0, 3)
                                .join(', ')}
                              {f.familyMembersList.length > 3 && ` +${f.familyMembersList.length - 3} more`}
                            </span>
                          </div>
                        )}
                        {f.houseOwnership && (
                          <div className="benef-card-row">
                            <span className="benef-label">House Ownership</span>
                            <span style={{ textTransform: 'capitalize' }}>{f.houseOwnership}</span>
                          </div>
                        )}
                        {f.shelterDamage && f.shelterDamage !== 'none' && (
                          <div className="benef-card-row">
                            <span className="benef-label">Shelter Damage</span>
                            <span className={`benef-damage-tag ${f.shelterDamage}`}>
                              {f.shelterDamage === 'totally-damaged' ? 'Totally Damaged' : 'Partially Damaged'}
                            </span>
                          </div>
                        )}
                        {f.notes && (
                          <div className="benef-card-row">
                            <span className="benef-label">Notes</span>
                            <span className="benef-notes">{f.notes}</span>
                          </div>
                        )}
                      </div>
                      <div className="benef-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="benef-view-btn"
                          onClick={() => setSelectedFamily(f)}
                          title="View Full Family Details"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="inventory-edit-btn"
                          disabled={actionId === f.docId}
                          onClick={() => openEditForm(f)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="requests-delete-btn"
                          disabled={actionId === f.docId}
                          onClick={() => handleDelete(f.docId)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="requests-modal-overlay" onClick={closeForm}>
          <div className="requests-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingDocId ? 'Edit Family' : 'Add Family'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="benef-name">Family Name</label>
                  <input
                    id="benef-name"
                    type="text"
                    placeholder="e.g. Santos"
                    value={form.familyName}
                    onChange={(e) => setForm((f) => ({ ...f, familyName: e.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="benef-barangay">Barangay</label>
                  <input
                    id="benef-barangay"
                    type="text"
                    placeholder="e.g. Barangay 1"
                    value={form.barangay}
                    onChange={(e) => setForm((f) => ({ ...f, barangay: e.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="benef-members">Family Members</label>
                  <input
                    id="benef-members"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    value={form.members}
                    onChange={(e) => setForm((f) => ({ ...f, members: e.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="benef-econ">Economic Status</label>
                  <select
                    id="benef-econ"
                    className="requests-status-select"
                    style={{ width: '100%' }}
                    value={form.economicStatus}
                    onChange={(e) => setForm((f) => ({ ...f, economicStatus: e.target.value }))}
                    disabled={saving}
                  >
                    <option value="not-set">Select Status</option>
                    {ECONOMIC_STATUSES.map((e) => (
                      <option key={e.id} value={e.id} title={e.description}>{e.label}</option>
                    ))}
                  </select>
                </div>
                <div className="requests-form-field" />
              </div>
              <div className="requests-form-field">
                <label htmlFor="benef-notes">Notes (optional)</label>
                <textarea
                  id="benef-notes"
                  placeholder="Additional info..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="requests-modal-actions">
                <button type="button" className="requests-btn-secondary" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="requests-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingDocId ? 'Save Changes' : 'Add Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Family Details Modal */}
      {selectedFamily && (
        <div className="benef-modal-overlay" onClick={() => setSelectedFamily(null)}>
          <div className="benef-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="benef-details-header">
              <div className="benef-details-title-wrap">
                <Users size={22} style={{ color: '#2563eb' }} />
                <h3>{selectedFamily.familyName} Family</h3>
                {selectedFamily.householdNumber && (
                  <span className="benef-hh-badge">
                    HH: {selectedFamily.householdNumber}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="benef-details-close-btn"
                onClick={() => setSelectedFamily(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="benef-details-body">
              {/* Badges Bar */}
              <div className="benef-details-badges">
                <span className="benef-card-members" style={{ fontSize: '13px' }}>
                  {selectedFamily.members} member{selectedFamily.members > 1 ? 's' : ''}
                </span>
                {selectedFamily.classification && selectedFamily.classification !== 'none' && (
                  <span className={`benef-class-badge ${selectedFamily.classification}`}>
                    {getClassLabel(selectedFamily.classification)}
                  </span>
                )}
                {selectedFamily.is4PsBeneficiary && (
                  <span className="benef-4ps-badge">4Ps Beneficiary</span>
                )}
                {selectedFamily.shelterDamage && selectedFamily.shelterDamage !== 'none' && (
                  <span className={`benef-damage-tag ${selectedFamily.shelterDamage}`}>
                    {selectedFamily.shelterDamage === 'totally-damaged' ? 'Totally Damaged' : 'Partially Damaged'}
                  </span>
                )}
              </div>

              {/* Head of Family & Demographics */}
              <div className="benef-section">
                <h4 className="benef-section-title">
                  <User size={15} />
                  <span>Head of Family &amp; Representative</span>
                </h4>
                <div className="benef-details-grid">
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Head of Family</span>
                    <span className="benef-detail-val">{selectedFamily.headOfFamily || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Household Number</span>
                    <span className="benef-detail-val" style={{ color: '#2563eb' }}>
                      {selectedFamily.householdNumber || '—'}
                    </span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Date of Birth</span>
                    <span className="benef-detail-val">{selectedFamily.repBirthDate || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Age &amp; Sex</span>
                    <span className="benef-detail-val">
                      {[selectedFamily.repAge ? `${selectedFamily.repAge} yrs old` : '', selectedFamily.repSex].filter(Boolean).join(' • ') || '—'}
                    </span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Civil Status</span>
                    <span className="benef-detail-val">{selectedFamily.repCivilStatus || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Occupation</span>
                    <span className="benef-detail-val">{selectedFamily.repOccupation || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Monthly Family Net Income</span>
                    <span className="benef-detail-val">{selectedFamily.repMonthlyIncome || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Contact Number</span>
                    <span className="benef-detail-val">{selectedFamily.contactNumber || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Residence & Disaster Profile */}
              <div className="benef-section">
                <h4 className="benef-section-title">
                  <Home size={15} />
                  <span>Residence &amp; Disaster Profile</span>
                </h4>
                <div className="benef-details-grid">
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Barangay</span>
                    <span className="benef-detail-val">{selectedFamily.barangay || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Specific Location / Sitio</span>
                    <span className="benef-detail-val">{selectedFamily.location || '—'}</span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">House Ownership</span>
                    <span className="benef-detail-val" style={{ textTransform: 'capitalize' }}>
                      {selectedFamily.houseOwnership || 'Owner'}
                    </span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Shelter Damage</span>
                    <span className="benef-detail-val">
                      {selectedFamily.shelterDamage === 'totally-damaged'
                        ? 'Totally Damaged'
                        : selectedFamily.shelterDamage === 'partially-damaged'
                        ? 'Partially Damaged'
                        : 'Not Damaged / Intact'}
                    </span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">4Ps Beneficiary</span>
                    <span className="benef-detail-val">
                      {selectedFamily.is4PsBeneficiary ? 'Yes (Pantawid Pamilya)' : 'No'}
                    </span>
                  </div>
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Evacuation Status</span>
                    <span className="benef-detail-val">
                      {selectedFamily.evacuationCenter
                        ? `Yes (Inside: ${selectedFamily.evacuationCenter})`
                        : selectedFamily.isInsideCenter
                        ? 'Yes, Inside Evacuation Center'
                        : 'No, At Home'}
                    </span>
                  </div>
                  {selectedFamily.pwdAssistiveDevice && selectedFamily.pwdAssistiveDevice !== 'None / Not needed' && (
                    <div className="benef-detail-field full-width">
                      <span className="benef-detail-label">PWD Assistive Device Needed</span>
                      <span className="benef-detail-val">{selectedFamily.pwdAssistiveDevice}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Affected Vulnerable Groups */}
              {selectedFamily.categories && (
                (Number(selectedFamily.categories.pregnantWomen?.count) > 0 ||
                 Number(selectedFamily.categories.lactatingMothers?.count) > 0 ||
                 Number(selectedFamily.categories.elders?.count) > 0 ||
                 Number(selectedFamily.categories.pwd?.count) > 0 ||
                 Number(selectedFamily.categories.childrenBelow7?.count) > 0) && (
                  <div className="benef-section">
                    <h4 className="benef-section-title">
                      <Shield size={15} />
                      <span>Affected Vulnerable Family Groups</span>
                    </h4>
                    <div className="benef-vulnerable-pills">
                      {Number(selectedFamily.categories.pregnantWomen?.count) > 0 && (
                        <span className="benef-vulnerable-pill">
                          🤰 Pregnant Women: {selectedFamily.categories.pregnantWomen.count}
                        </span>
                      )}
                      {Number(selectedFamily.categories.lactatingMothers?.count) > 0 && (
                        <span className="benef-vulnerable-pill">
                          🤱 Lactating Mothers: {selectedFamily.categories.lactatingMothers.count}
                        </span>
                      )}
                      {Number(selectedFamily.categories.elders?.count) > 0 && (
                        <span className="benef-vulnerable-pill">
                          👵 Elderly / Seniors: {selectedFamily.categories.elders.count}
                        </span>
                      )}
                      {Number(selectedFamily.categories.pwd?.count) > 0 && (
                        <span className="benef-vulnerable-pill">
                          ♿ PWD: {selectedFamily.categories.pwd.count}
                        </span>
                      )}
                      {Number(selectedFamily.categories.childrenBelow7?.count) > 0 && (
                        <span className="benef-vulnerable-pill">
                          🧒 Children Below 7: {selectedFamily.categories.childrenBelow7.count}
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Household Roster Table */}
              <div className="benef-section">
                <h4 className="benef-section-title">
                  <Users size={15} />
                  <span>Household Roster ({selectedFamily.familyMembersList?.length || 0} Members Listed)</span>
                </h4>
                {selectedFamily.familyMembersList && selectedFamily.familyMembersList.length > 0 ? (
                  <div className="benef-members-table-wrap">
                    <table className="benef-members-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Full Name</th>
                          <th>Relationship</th>
                          <th>Age</th>
                          <th>Sex</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFamily.familyMembersList.map((m, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{m.name || '—'}</td>
                            <td>{m.relation || '—'}</td>
                            <td>{m.age ? `${m.age} yrs old` : '—'}</td>
                            <td>{m.sex || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
                    No additional household members listed separately in roster.
                  </div>
                )}
              </div>

              {/* Notes & System Info */}
              <div className="benef-section">
                <h4 className="benef-section-title">
                  <FileText size={15} />
                  <span>Record Information &amp; Notes</span>
                </h4>
                <div className="benef-details-grid">
                  {selectedFamily.latestRequestId && (
                    <div className="benef-detail-field">
                      <span className="benef-detail-label">Latest Relief Request ID</span>
                      <span className="benef-detail-val">{selectedFamily.latestRequestId}</span>
                    </div>
                  )}
                  <div className="benef-detail-field">
                    <span className="benef-detail-label">Registered Date</span>
                    <span className="benef-detail-val">{formatFamilyDate(selectedFamily.createdAt)}</span>
                  </div>
                  {selectedFamily.notes && (
                    <div className="benef-detail-field full-width">
                      <span className="benef-detail-label">Notes / Remarks</span>
                      <span className="benef-detail-val" style={{ fontStyle: 'italic' }}>
                        {selectedFamily.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="benef-details-footer">
              <button
                type="button"
                className="requests-btn-secondary"
                onClick={() => setSelectedFamily(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="requests-btn-primary"
                onClick={() => {
                  const target = selectedFamily
                  setSelectedFamily(null)
                  openEditForm(target)
                }}
              >
                Edit Family
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
