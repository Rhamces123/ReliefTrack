import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createFamily,
  subscribeFamilies,
  updateFamily,
  deleteFamily,
  CLASSIFICATIONS,
} from '../firebase/families'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Beneficiaries.css'

const EMPTY_FORM = {
  familyName: '',
  barangay: '',
  headOfFamily: '',
  contactNumber: '',
  members: '1',
  classification: 'none',
  notes: '',
}

function getClassLabel(id) {
  return CLASSIFICATIONS.find((c) => c.id === id)?.label || id
}

export default function Beneficiaries() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDocId, setEditingDocId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')

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

  const filtered = useMemo(() => {
    let list = families
    if (classFilter !== 'all') {
      list = list.filter((f) => f.classification === classFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (f) =>
          f.familyName?.toLowerCase().includes(q) ||
          f.barangay?.toLowerCase().includes(q) ||
          f.headOfFamily?.toLowerCase().includes(q)
      )
    }
    return list
  }, [families, classFilter, searchQuery])

  const stats = useMemo(() => {
    const total = families.length
    const totalMembers = families.reduce((s, f) => s + (Number(f.members) || 0), 0)
    const barangays = new Set(families.map((f) => f.barangay)).size
    return { total, totalMembers, barangays }
  }, [families])

  const openAddForm = () => {
    setEditingDocId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (f) => {
    setEditingDocId(f.docId)
    setForm({
      familyName: f.familyName || '',
      barangay: f.barangay || '',
      headOfFamily: f.headOfFamily || '',
      contactNumber: f.contactNumber || '',
      members: String(f.members || '1'),
      classification: f.classification || 'none',
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
        <div className="benef-header-actions">
          {isAdmin && (
            <button type="button" className="requests-btn-primary" onClick={openAddForm}>
              + Add Family
            </button>
          )}
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
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="all">All Classifications</option>
          {CLASSIFICATIONS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="dashboard-activity">
        {loading && !error ? (
          <p className="requests-loading">Loading families...</p>
        ) : error && families.length === 0 ? (
          <p className="dashboard-empty">Unable to load. Check connection and try again.</p>
        ) : filtered.length === 0 ? (
          <p className="dashboard-empty">
            {families.length === 0 ? 'No families registered yet.' : 'No families match your filters.'}
          </p>
        ) : (
          <div className="benef-grid">
            {filtered.map((f) => (
              <div key={f.docId} className="benef-card">
                <div className="benef-card-header">
                  <div className="benef-card-title">
                    <h3>{f.familyName}</h3>
                    <span className={`benef-class-badge ${f.classification}`}>
                      {getClassLabel(f.classification)}
                    </span>
                  </div>
                  <div className="benef-card-members">{f.members} member{f.members > 1 ? 's' : ''}</div>
                </div>
                <div className="benef-card-body">
                  <div className="benef-card-row">
                    <span className="benef-label">Barangay</span>
                    <span>{f.barangay}</span>
                  </div>
                  <div className="benef-card-row">
                    <span className="benef-label">Head of Family</span>
                    <span>{f.headOfFamily || '—'}</span>
                  </div>
                  <div className="benef-card-row">
                    <span className="benef-label">Contact</span>
                    <span>{f.contactNumber || '—'}</span>
                  </div>
                  {f.notes && (
                    <div className="benef-card-row">
                      <span className="benef-label">Notes</span>
                      <span className="benef-notes">{f.notes}</span>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="benef-card-actions">
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
                )}
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
                  <label htmlFor="benef-head">Head of Family</label>
                  <input
                    id="benef-head"
                    type="text"
                    placeholder="Full name"
                    value={form.headOfFamily}
                    onChange={(e) => setForm((f) => ({ ...f, headOfFamily: e.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="benef-contact">Contact Number</label>
                  <input
                    id="benef-contact"
                    type="text"
                    placeholder="09XXXXXXXXX"
                    value={form.contactNumber}
                    onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
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
                <div className="requests-form-field">
                  <label htmlFor="benef-class">Classification</label>
                  <select
                    id="benef-class"
                    className="requests-status-select"
                    style={{ width: '100%' }}
                    value={form.classification}
                    onChange={(e) => setForm((f) => ({ ...f, classification: e.target.value }))}
                    disabled={saving}
                  >
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
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
    </DashboardLayout>
  )
}
