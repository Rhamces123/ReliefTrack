import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeFamilies, ECONOMIC_STATUSES } from '../firebase/families'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/PriorityIndividuals.css'

const ECON_PRIORITY = { 'financially-incapable': 5, 'lower-middle': 4, middle: 3, 'upper-middle': 2, wealthy: 1 }

const ECON_COLORS = {
  'financially-incapable': '#ff7070',
  'lower-middle': '#ffb833',
  middle: '#6bbaff',
  'upper-middle': '#7ddb7d',
  wealthy: '#d4c44a',
}

function getEconLabel(id) {
  return ECONOMIC_STATUSES.find((e) => e.id === id)?.label || 'Not Set'
}

export default function PriorityIndividuals() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('all')
  const [econFilter, setEconFilter] = useState('all')

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    setLoading(true); setError('')
    const unsub = subscribeFamilies(
      (data) => {
        setFamilies(data)
        setLoading(false)
      },
      (err) => {
        setError(err.message || 'Failed to load data.')
        setLoading(false)
      },
      { uid: user.uid, role: profile?.role }
    )
    return unsub
  }, [user?.uid, profile?.role])

  const stats = useMemo(() => {
    const counts = {}
    for (const f of families) {
      const key = f.economicStatus || 'not-set'
      counts[key] = (counts[key] || 0) + 1
    }
    const barangays = new Set(families.map((f) => f.barangay).filter(Boolean)).size
    return { total: families.length, barangays, counts }
  }, [families])

  const barangayList = useMemo(() => {
    const set = new Set(families.map((f) => f.barangay).filter(Boolean))
    return ['all', ...[...set].sort()]
  }, [families])

  const groups = useMemo(() => {
    const map = {}
    for (const f of families) {
      const bg = f.barangay || 'Unknown'
      if (!map[bg]) map[bg] = []
      map[bg].push(f)
    }
    const result = Object.entries(map).map(([barangay, items]) => {
      const score = (f) => ECON_PRIORITY[f.economicStatus] || 0
      items.sort((a, b) => score(b) - score(a))
      return { barangay, items, count: items.length }
    })
    result.sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay))
    return result
  }, [families])

  const filtered = useMemo(() => {
    let list = groups
    if (barangayFilter !== 'all') {
      list = list.filter((g) => g.barangay === barangayFilter)
    }
    if (econFilter !== 'all') {
      list = list
        .map((g) => ({ ...g, items: g.items.filter((f) => (f.economicStatus || 'not-set') === econFilter) }))
        .filter((g) => g.items.length > 0)
    }
    return list
  }, [groups, barangayFilter, econFilter])

  const totalFamilies = useMemo(() => families.length, [families])

  return (
    <DashboardLayout title="Priority Individuals" userLabel={displayName} userEmail={email}>
      <div className="pri-header">
        <div className="pri-header-text">
          <h2>Priority Individuals per Barangay</h2>
          <p>Ranked by economic status — Financially Incapable first.</p>
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && (
        <div className="pri-stats">
          <div className="pri-stat-card">
            <span className="pri-stat-icon">🏠</span>
            <div><strong>{totalFamilies}</strong><span>Total Families</span></div>
          </div>
          <div className="pri-stat-card">
            <span className="pri-stat-icon">📍</span>
            <div><strong>{stats.barangays}</strong><span>Barangays</span></div>
          </div>
          {Object.entries(stats.counts).map(([key, val]) => (
            <div key={key} className="pri-stat-card">
              <span className="pri-stat-icon" style={{ color: ECON_COLORS[key] || '#888' }}>●</span>
              <div><strong>{val}</strong><span>{getEconLabel(key)}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="pri-toolbar">
        <div className="pri-filters">
          <select className="pri-filter" value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)}>
            {barangayList.map((b) => (
              <option key={b} value={b}>{b === 'all' ? 'All Barangays' : b}</option>
            ))}
          </select>
          <select className="pri-filter" value={econFilter} onChange={(e) => setEconFilter(e.target.value)}>
            <option value="all">All Economic Status</option>
            {ECONOMIC_STATUSES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>
        <span className="pri-count">{totalFamilies} familie{totalFamilies !== 1 ? 's' : ''}</span>
      </div>

      <div className="dashboard-activity">
        {loading ? (
          <p className="requests-loading">Loading priority data...</p>
        ) : filtered.length === 0 ? (
          <div className="pri-empty">
            <span className="pri-empty-icon">🛡️</span>
            <h3>No families found</h3>
            <p>Register families in the Beneficiaries page to see them here.</p>
          </div>
        ) : (
          <div className="pri-list">
            {filtered.map((group) => (
              <div key={group.barangay} className="pri-group">
                <div className="pri-group-header">
                  <h3>📍 {group.barangay}</h3>
                  <span className="pri-group-count">{group.count} familie{group.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="pri-group-list">
                  {group.items.map((f, idx) => {
                    const econColor = ECON_COLORS[f.economicStatus] || '#6b7280'
                    return (
                      <div key={f.docId} className="pri-individual" style={{ '--idx': idx, '--accent': econColor }}>
                        <div className="pri-ind-left">
                          <span className="pri-rank">#{idx + 1}</span>
                          <div className="pri-ind-info">
                            <span className="pri-ind-name">{f.familyName}</span>
                            <span className="pri-ind-head">{f.headOfFamily || '—'}</span>
                          </div>
                        </div>
                        <div className="pri-ind-right">
                          <span className={`pri-econ-badge ${f.economicStatus || 'not-set'}`}>
                            {getEconLabel(f.economicStatus)}
                          </span>
                          {f.contactNumber && <span className="pri-contact">{f.contactNumber}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}