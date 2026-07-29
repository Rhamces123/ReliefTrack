import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeFamilies, CLASSIFICATIONS, ECONOMIC_STATUSES } from '../firebase/families'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/PriorityIndividuals.css'

const PRIORITY_ORDER = { pwd: 5, elderly: 4, pregnant: 3, child: 2, 'solo-parent': 1 }
const ECON_PRIORITY = { 'financially-incapable': 5, 'lower-middle': 3, middle: 1, 'upper-middle': 0, wealthy: -1 }

const CLASS_META = {
  pwd:         { label: 'PWD',           emoji: '♿', color: '#ef4444' },
  elderly:     { label: 'Elderly',       emoji: '👴', color: '#f59e0b' },
  pregnant:    { label: 'Pregnant Woman', emoji: '🤰', color: '#ec4899' },
  child:       { label: 'Child Below 7', emoji: '👶', color: '#0ea5e9' },
  'solo-parent': { label: 'Solo Parent', emoji: '👤', color: '#8b5cf6' },
}

function getClassMeta(id) {
  return CLASS_META[id] || { label: id, emoji: '🏷️', color: '#6b7280' }
}
function getEconLabel(id) {
  return ECONOMIC_STATUSES.find((e) => e.id === id)?.label || ''
}

export default function PriorityIndividuals() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
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
        const vulnerable = data.filter((f) => f.classification && f.classification !== 'none')
        setFamilies(vulnerable)
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
      if (!counts[f.classification]) counts[f.classification] = 0
      counts[f.classification]++
    }
    const barangays = new Set(families.map((f) => f.barangay)).size
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
      const score = (f) => (PRIORITY_ORDER[f.classification] || 0) + (ECON_PRIORITY[f.economicStatus] || 0)
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
    if (classFilter !== 'all') {
      list = list
        .map((g) => ({ ...g, items: g.items.filter((f) => f.classification === classFilter) }))
        .filter((g) => g.items.length > 0)
    }
    if (econFilter !== 'all') {
      list = list
        .map((g) => ({ ...g, items: g.items.filter((f) => f.economicStatus === econFilter) }))
        .filter((g) => g.items.length > 0)
    }
    return list
  }, [groups, barangayFilter, classFilter, econFilter])

  const totalVulnerable = useMemo(() => families.length, [families])

  return (
    <DashboardLayout title="Priority Individuals" userLabel={displayName} userEmail={email}>
      <div className="pri-header">
        <div className="pri-header-text">
          <h2>Priority Individuals per Barangay</h2>
          <p>Automatically ranked by vulnerability — PWD, Elderly, Pregnant, Children, Solo Parents.</p>
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && (
        <div className="pri-stats">
          <div className="pri-stat-card">
            <span className="pri-stat-icon">⚠️</span>
            <div><strong>{totalVulnerable}</strong><span>Vulnerable Families</span></div>
          </div>
          <div className="pri-stat-card">
            <span className="pri-stat-icon">📍</span>
            <div><strong>{stats.barangays}</strong><span>Barangays</span></div>
          </div>
          {Object.entries(stats.counts).map(([key, val]) => {
            const meta = getClassMeta(key)
            return (
              <div key={key} className="pri-stat-card pri-stat-class">
                <span className="pri-stat-icon">{meta.emoji}</span>
                <div><strong>{val}</strong><span>{meta.label}</span></div>
              </div>
            )
          })}
        </div>
      )}

      <div className="pri-toolbar">
        <div className="pri-filters">
          <select className="pri-filter" value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)}>
            {barangayList.map((b) => (
              <option key={b} value={b}>{b === 'all' ? 'All Barangays' : b}</option>
            ))}
          </select>
          <select className="pri-filter" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All Vulnerabilities</option>
            {CLASSIFICATIONS.filter((c) => c.id !== 'none').map((c) => (
              <option key={c.id} value={c.id}>{getClassMeta(c.id).emoji} {c.label}</option>
            ))}
          </select>
          <select className="pri-filter" value={econFilter} onChange={(e) => setEconFilter(e.target.value)}>
            <option value="all">All Economic Status</option>
            {ECONOMIC_STATUSES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>
        <span className="pri-count">{totalVulnerable} vulnerable familie{totalVulnerable !== 1 ? 's' : ''}</span>
      </div>

      <div className="dashboard-activity">
        {loading ? (
          <p className="requests-loading">Loading priority data...</p>
        ) : filtered.length === 0 ? (
          <div className="pri-empty">
            <span className="pri-empty-icon">🛡️</span>
            <h3>No vulnerable families found</h3>
            <p>Register families with classifications in the Beneficiaries page to see them here.</p>
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
                    const meta = getClassMeta(f.classification)
                    return (
                      <div key={f.docId} className="pri-individual" style={{ '--idx': idx, '--accent': meta.color }}>
                        <div className="pri-ind-left">
                          <span className="pri-rank">#{idx + 1}</span>
                          <div className="pri-ind-info">
                            <span className="pri-ind-name">{f.familyName}</span>
                            <span className="pri-ind-head">{f.headOfFamily || '—'}</span>
                          </div>
                        </div>
                        <div className="pri-ind-right">
                          <span className="pri-class-badge" style={{ background: meta.color }}>
                            {meta.emoji} {meta.label}
                          </span>
                          {getEconLabel(f.economicStatus) && (
                            <span className={`pri-econ-badge ${f.economicStatus}`}>
                              {getEconLabel(f.economicStatus)}
                            </span>
                          )}
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
