import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
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

const DONATION_TYPES = ['Food', 'Water', 'Medical', 'Clothing', 'Cash', 'Other']

const TYPE_META = {
  Food:    { emoji: '🍱', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  Water:   { emoji: '💧', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)' },
  Medical: { emoji: '💊', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  Clothing:{ emoji: '👕', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
  Cash:    { emoji: '💰', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  Other:   { emoji: '📦', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)' },
}

const EMPTY_FORM = {
  agency: '', type: 'Food', items: '', quantity: '', unit: '', notes: '',
}

function formatDate(d) {
  if (!d) return '—'
  try { return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return '—' }
}

function tintColor(gradient) {
  const m = gradient.match(/#[a-f0-9]{6}/gi)
  return m ? m[0] : '#7850ff'
}

function CircularProgress({ value, max, gradient, label }) {
  const r = 28; const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const offset = circ - pct * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="don-ring">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ color: tintColor(gradient), transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
      <text x="36" y="34" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{value}</text>
      <text x="36" y="48" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">{label}</text>
    </svg>
  )
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
  const gridRef = useRef(null)

  const isAdmin = profile?.role === 'Admin'
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    setLoading(true); setError('')
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

  const handleMouseMove = useCallback((e) => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.don-card')
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left; const y = e.clientY - rect.top
      card.style.setProperty('--mouse-x', `${x}px`)
      card.style.setProperty('--mouse-y', `${y}px`)
      const cx = rect.width / 2; const cy = rect.height / 2
      const rx = ((y - cy) / cy) * -8; const ry = ((x - cx) / cx) * 8
      card.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.don-card')
    cards.forEach((card) => {
      card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0)'
    })
  }, [])

  return (
    <DashboardLayout title="Donations" userLabel={displayName} userEmail={email}>
      <div className="don-ambient">
        <div className="don-orb don-orb-1" /><div className="don-orb don-orb-2" /><div className="don-orb don-orb-3" />
      </div>

      {celebrate && <div className="don-confetti"><span /><span /><span /><span /><span /><span /><span /><span /></div>}

      <div className="don-header">
        <div className="don-header-text">
          <h2>🤝 Donation Input from Private Agencies</h2>
          <p>Track and manage relief donations with transparency and impact.</p>
        </div>
        {isAdmin && (
          <button type="button" className="don-add-btn" onClick={openAddForm}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            New donation
          </button>
        )}
      </div>

      {error && <div className="requests-error">{error}</div>}

      {/* Stats Dashboard */}
      {!loading && donations.length > 0 && (
        <div className="don-stats">
          <div className="don-stat-card">
            <span className="don-stat-icon">📦</span>
            <div><strong><CountUp to={stats.total} /></strong><span>Total Donations</span></div>
          </div>
          <div className="don-stat-card">
            <span className="don-stat-icon">📊</span>
            <div><strong><CountUp to={stats.totalQty} /></strong><span>Total Quantity</span></div>
          </div>
          <div className="don-stat-card">
            <span className="don-stat-icon">🏢</span>
            <div><strong><CountUp to={stats.agencies} /></strong><span>Agencies</span></div>
          </div>
          <div className="don-stat-card don-stat-types">
            {DONATION_TYPES.map((t) => (
              <span key={t} className="don-stat-type" style={{ background: TYPE_META[t].gradient }}>
                {TYPE_META[t].emoji} {stats.typeCount[t]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Impact Gauge */}
      {!loading && donations.length > 0 && (
        <div className="don-impact">
          <div className="don-impact-inner">
            <CircularProgress value={stats.total} max={Math.max(stats.total, 20)} gradient="linear-gradient(135deg, #7850ff, #00c8c8)" label="donations" />
            <CircularProgress value={stats.agencies} max={Math.max(stats.agencies, 5)} gradient="linear-gradient(135deg, #10b981, #059669)" label="agencies" />
            <CircularProgress value={stats.totalQty} max={Math.max(stats.totalQty, 100)} gradient="linear-gradient(135deg, #f59e0b, #d97706)" label="quantity" />
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
              {t === 'all' ? 'All' : `${TYPE_META[t].emoji} ${t}`}
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
            <span className="don-empty-icon">{filter === 'all' ? '📭' : TYPE_META[filter]?.emoji}</span>
            <h3>No donations yet</h3>
            <p>{filter === 'all' ? 'Be the first to record a donation from a private agency.' : `No ${filter.toLowerCase()} donations recorded.`}</p>
            {isAdmin && (
              <button type="button" className="don-add-btn" onClick={openAddForm}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add donation
              </button>
            )}
          </div>
        ) : (
          <div className="don-grid" ref={gridRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            {filtered.map((d, idx) => {
              const meta = TYPE_META[d.type] || TYPE_META.Other
              const qty = Number(d.quantity) || 0
              return (
                <div key={d.docId} className="don-card" style={{ '--card-glow': meta.gradient, '--idx': idx }}>
                  <div className="don-card-glow" />
                  <div className="don-card-top">
                    <span className="don-badge" style={{ background: meta.gradient }}>
                      {meta.emoji} {d.type}
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
            <h3 className="don-modal-title">{editingDocId ? '✏️ Edit donation' : '➕ New donation'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="requests-form-field">
                <label htmlFor="don-agency">Agency name</label>
                <input id="don-agency" type="text" placeholder="e.g. Philippine Red Cross" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} required disabled={saving} />
              </div>
              <div className="requests-form-field">
                <label htmlFor="don-type">Donation type</label>
                <select id="don-type" className="requests-status-select" style={{ width: '100%' }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} disabled={saving}>
                  {DONATION_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t].emoji} {t}</option>
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
