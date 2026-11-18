import { useEffect, useState, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  HandHeart,
  Package,
  BarChart3,
  Building2,
  Utensils,
  Droplets,
  Pill,
  Shirt,
  Coins,
  Inbox,
  Pencil,
  Plus,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createDonation,
  subscribeDonations,
  updateDonation,
  deleteDonation,
} from '../firebase/donations'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/Donations.css'

const DONATION_TYPES = ['Food', 'Water', 'Medical', 'Clothing', 'Other']

const TYPE_META = {
  Food:    { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  Water:   { gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)' },
  Medical: { gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  Clothing:{ gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  Cash:    { gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  Other:   { gradient: 'linear-gradient(135deg, #6b7280, #4b5563)' },
}

function TypeIcon({ type, size = 14, className = '', style = {} }) {
  switch (type) {
    case 'Food':
      return <Utensils size={size} className={className} style={style} />
    case 'Water':
      return <Droplets size={size} className={className} style={style} />
    case 'Medical':
      return <Pill size={size} className={className} style={style} />
    case 'Clothing':
      return <Shirt size={size} className={className} style={style} />
    case 'Cash':
      return <Coins size={size} className={className} style={style} />
    case 'Other':
    default:
      return <Package size={size} className={className} style={style} />
  }
}

const EMPTY_FORM = {
  agency: '', type: 'Food', items: '', quantity: '', unit: '', notes: '',
}

function formatDate(d) {
  if (!d) return '—'
  try { return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return '—' }
}

function CountUp({ to, suffix = '' }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      let start = 0; const dur = 1200; const step = 16; const inc = to / (dur / step)
      const id = setInterval(() => { start += inc; if (start >= to) { setV(to); clearInterval(id) } else setV(Math.floor(start)) }, step)
      obs.disconnect()
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{v}{suffix}</span>
}

export default function Donations() {
  const { user } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingDocId, setEditingDocId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [celebrate, setCelebrate] = useState(false)

  const isAdmin = profile?.role === 'Admin'
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (location.state?.openForm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingDocId(null)
      setForm(EMPTY_FORM)
      setShowForm(true)
      window.history.replaceState({}, document.title)
    }
  }, [location.state?.openForm])

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    const unsub = subscribeDonations(
      (data) => { setDonations(data); setLoading(false) },
      (err) => { setError(err.message || 'Failed to load donations.'); setLoading(false) }
    )
    return unsub
  }, [])

  const filtered = filter === 'all' ? donations : donations.filter((d) => d.type === filter)

  const stats = useMemo(() => {
    const total = donations.length
    const totalQty = donations.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
    const agencies = new Set(donations.map((d) => d.agency?.toLowerCase().trim()).filter(Boolean)).size
    const typeCount = {}
    DONATION_TYPES.forEach((t) => { typeCount[t] = donations.filter((d) => d.type === t).length })
    return { total, totalQty, agencies, typeCount }
  }, [donations])

  const maxQty = useMemo(() => Math.max(...donations.map((d) => Number(d.quantity) || 0), 1), [donations])

  const openAddForm = () => {
    setEditingDocId(null); setForm(EMPTY_FORM); setShowForm(true)
  }

  const openEditForm = (d) => {
    setEditingDocId(d.docId)
    setForm({
      agency: d.agency || '', type: d.type || 'Food', items: d.items || '',
      quantity: String(d.quantity ?? ''), unit: d.unit || '', notes: d.notes || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false); setEditingDocId(null); setForm(EMPTY_FORM)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.agency.trim()) return
    setSaving(true); setError('')
    try {
      const payload = { agency: form.agency, type: form.type, items: form.items, quantity: form.quantity, unit: form.unit, notes: form.notes }
      if (editingDocId) {
        await updateDonation(editingDocId, payload)
      } else {
        await createDonation(payload, user)
        setCelebrate(true); setTimeout(() => setCelebrate(false), 2000)
      }
      closeForm()
    } catch (err) {
      setError(err.message || 'Failed to save donation.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this donation record?')) return
    setActionId(docId); setError('')
    try { await deleteDonation(docId) } catch (err) { setError(err.message || 'Failed to delete donation.') }
    finally { setActionId(null) }
  }

  return (
    <DashboardLayout title="Donations" userLabel={displayName} userEmail={email}>

      {celebrate && <div className="don-confetti"><span /><span /><span /><span /><span /><span /><span /><span /></div>}

      <div className="don-header">
        <div className="don-header-text">
          <h2>
            <HandHeart size={26} style={{ flexShrink: 0 }} />
            <span>Donation Input from Private Agencies</span>
          </h2>
          <p>Track and manage relief donations with transparency and impact.</p>
        </div>
        {isAdmin && (
          <button type="button" className="don-add-btn" onClick={openAddForm}>
            <Plus size={16} />
            <span>New donation</span>
          </button>
        )}
      </div>

      {error && <div className="requests-error">{error}</div>}

      {/* Stats Dashboard */}
      {!loading && donations.length > 0 && (
        <div className="don-stats">
          <div className="don-stat-card">
            <span className="don-stat-icon">
              <Package size={22} />
            </span>
            <div><strong><CountUp to={stats.total} /></strong><span>Total Donations</span></div>
          </div>
          <div className="don-stat-card">
            <span className="don-stat-icon">
              <BarChart3 size={22} />
            </span>
            <div><strong><CountUp to={stats.totalQty} /></strong><span>Total Quantity</span></div>
          </div>
          <div className="don-stat-card">
            <span className="don-stat-icon">
              <Building2 size={22} />
            </span>
            <div><strong><CountUp to={stats.agencies} /></strong><span>Agencies</span></div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="don-filters-wrap">
        <div className="don-filters">
          {['all', ...DONATION_TYPES].map((t) => (
            <button
              key={t}
              type="button"
              className={`don-filter-tab ${filter === t ? 'active' : ''}`}
              style={t !== 'all' && filter === t ? { '--tab-glow': TYPE_META[t].gradient } : {}}
              onClick={() => setFilter(t)}
            >
              {t === 'all' ? (
                'All'
              ) : (
                <>
                  <TypeIcon type={t} size={14} />
                  <span>{t}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="dashboard-activity">
        {loading ? (
          <div className="don-skeleton-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="don-skeleton-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="don-sk-badge" />
                <div className="don-sk-line w-60" />
                <div className="don-sk-line w-80" />
                <div className="don-sk-line w-40" />
              </div>
            ))}
          </div>
        ) : error && donations.length === 0 ? (
          <p className="dashboard-empty">Unable to load donations. Check Firestore rules and try again.</p>
        ) : filtered.length === 0 ? (
          <div className="don-empty">
            <span className="don-empty-icon">
              {filter === 'all' ? (
                <Inbox size={44} style={{ color: '#94a3b8' }} />
              ) : (
                <TypeIcon type={filter} size={44} style={{ color: '#94a3b8' }} />
              )}
            </span>
            <h3>No donations yet</h3>
            <p>{filter === 'all' ? 'Be the first to record a donation from a private agency.' : `No ${filter.toLowerCase()} donations recorded.`}</p>
            {isAdmin && (
              <button type="button" className="don-add-btn" onClick={openAddForm}>
                <Plus size={16} />
                <span>Add donation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="don-grid">
            {filtered.map((d, idx) => {
              const meta = TYPE_META[d.type] || TYPE_META.Other
              const qty = Number(d.quantity) || 0
              return (
                <div key={d.docId} className="don-card" style={{ '--card-glow': meta.gradient, '--idx': idx }}>
                  <div className="don-card-top">
                    <span className="don-badge" style={{ background: meta.gradient }}>
                      <TypeIcon type={d.type} size={13} />
                      <span>{d.type}</span>
                    </span>
                    {isAdmin && (
                      <div className="don-card-actions">
                        <button type="button" className="don-action-btn don-edit-btn" disabled={actionId === d.docId} onClick={() => openEditForm(d)}>Edit</button>
                        <button type="button" className="don-action-btn don-del-btn" disabled={actionId === d.docId} onClick={() => handleDelete(d.docId)}>Delete</button>
                      </div>
                    )}
                  </div>
                  <div className="don-card-body">
                    <h3 className="don-agency">{d.agency}</h3>
                    {d.items && <p className="don-items">{d.items}</p>}
                    {qty > 0 && (
                      <div className="don-qty-bar-wrap">
                        <div className="don-qty-bar" style={{ width: `${Math.min((qty / maxQty) * 100, 100)}%` }} />
                        <span className="don-qty-label">{qty} {d.unit || 'units'}</span>
                      </div>
                    )}
                    {d.notes && <p className="don-notes">{d.notes}</p>}
                    <div className="don-card-tags">
                      {d.unit && <span className="don-tag">{d.unit}</span>}
                      <span className="don-tag">{d.type}</span>
                    </div>
                  </div>
                  <div className="don-card-footer">
                    <span className="don-entered">by {d.createdByName || '—'}</span>
                    <span className="don-date">{formatDate(d.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="requests-modal-overlay don-modal-overlay" onClick={closeForm}>
          <div className="requests-modal don-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="don-modal-close" onClick={closeForm}>&times;</button>
            <h3 className="don-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingDocId ? (
                <>
                  <Pencil size={18} />
                  <span>Edit donation</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>New donation</span>
                </>
              )}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="requests-form-field">
                <label htmlFor="don-agency">Name</label>
                <input id="don-agency" type="text" placeholder="e.g. Juan Dela Cruz, Philippine Red Cross" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} required disabled={saving} />
              </div>
              <div className="requests-form-field">
                <label htmlFor="don-type">Donation type</label>
                <select id="don-type" className="requests-status-select" style={{ width: '100%' }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} disabled={saving}>
                  {DONATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="requests-form-field">
                <label htmlFor="don-items">Items donated</label>
                <input id="don-items" type="text" placeholder="e.g. 50 sacks of rice, 30 boxes of canned goods" value={form.items} onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))} disabled={saving} />
              </div>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="don-qty">Quantity</label>
                  <input id="don-qty" type="number" min="0" placeholder="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} disabled={saving} />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="don-unit">Unit</label>
                  <input id="don-unit" type="text" placeholder="e.g. boxes, kg, liters" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} disabled={saving} />
                </div>
              </div>
              <div className="requests-form-field">
                <label htmlFor="don-notes">Notes (optional)</label>
                <textarea id="don-notes" placeholder="Any additional details..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} disabled={saving} />
              </div>
              <div className="requests-modal-actions">
                <button type="button" className="requests-btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="don-btn-submit" disabled={saving}>
                  {saving ? 'Saving...' : editingDocId ? 'Save changes' : 'Add donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
