import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests, CATEGORY_LABELS } from '../firebase/requests'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/AdminAutoSuggest.css'

function totalAffected(r) {
  if (!r.categories) return 0
  return Object.values(r.categories).reduce((s, c) => s + (Number(c.count) || 0), 0)
}

function aggregateNeeds(requests) {
  const merged = {}
  for (const r of requests) {
    if (!r.categories) continue
    for (const [key, val] of Object.entries(r.categories)) {
      if (!merged[key]) merged[key] = { count: 0, needs: [] }
      merged[key].count += Number(val.count) || 0
      if (val.needs) merged[key].needs.push(val.needs)
    }
  }
  return merged
}

export default function AdminAutoSuggest() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Admin'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    const unsub = subscribeReliefRequests(
      (data) => { setRequests(data); setLoading(false) },
      () => setLoading(false),
      { uid: user.uid, role: profile?.role }
    )
    return unsub
  }, [user?.uid, profile?.role])

  const barangays = useMemo(() => {
    const map = {}
    for (const r of requests) {
      const loc = (r.location || 'Unknown').trim()
      if (!map[loc]) map[loc] = []
      map[loc].push(r)
    }
    return Object.entries(map)
      .map(([name, reqs]) => {
        const pending = reqs.filter((r) => r.status === 'pending').length
        const inProgress = reqs.filter((r) => r.status === 'in-progress').length
        const completed = reqs.filter((r) => r.status === 'completed').length
        const totalPeople = reqs.reduce((s, r) => s + totalAffected(r) + (Number(r.familyMembers) || 0), 0)
        const totalFamilies = reqs.reduce((s, r) => s + (r.familyMembers > 0 ? 1 : 0), 0)
        const priorityScore = pending * 3 + inProgress * 1 + totalPeople * 2 + totalFamilies * 1
        const needs = aggregateNeeds(reqs.filter((r) => r.status !== 'completed'))
        return { name, requests: reqs, pending, inProgress, completed, totalPeople, totalFamilies, priorityScore, needs }
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
  }, [requests])

  return (
    <DashboardLayout title="Auto Suggest" userLabel={displayName} userEmail={email}>
      <div className="autosuggest-header">
        <h2>Auto Suggest</h2>
        <p>Barangays ranked by urgency — suggests where to send relief goods and which category needs immediate assistance.</p>
      </div>

      {loading ? (
        <p className="autosuggest-loading">Analyzing requests...</p>
      ) : barangays.length === 0 ? (
        <p className="autosuggest-empty">No request data available yet.</p>
      ) : (
        <div className="autosuggest-list">
          {barangays.map((b, i) => (
            <div key={b.name} className={`autosuggest-card ${i === 0 ? 'top-priority' : ''}`}>
              <div className="autosuggest-card-header">
                <span className="autosuggest-rank">#{i + 1}</span>
                <div className="autosuggest-card-title">
                  <h3>{b.name}</h3>
                  <span className="autosuggest-urgency">
                    {i === 0 ? '🔴 Highest Priority' : i < 3 ? '🟡 High Priority' : '🟢 Monitor'}
                  </span>
                </div>
                <div className="autosuggest-score">Score: {b.priorityScore}</div>
              </div>

              <div className="autosuggest-card-stats">
                <div className="autosuggest-stat"><span className="stat-label">Pending</span><span className="stat-value pending">{b.pending}</span></div>
                <div className="autosuggest-stat"><span className="stat-label">In Progress</span><span className="stat-value inprogress">{b.inProgress}</span></div>
                <div className="autosuggest-stat"><span className="stat-label">Completed</span><span className="stat-value completed">{b.completed}</span></div>
                <div className="autosuggest-stat"><span className="stat-label">Affected People</span><span className="stat-value">{b.totalPeople}</span></div>
                <div className="autosuggest-stat"><span className="stat-label">Families</span><span className="stat-value">{b.totalFamilies}</span></div>
              </div>

              {Object.keys(b.needs).length > 0 && (
                <div className="autosuggest-needs">
                  <h4>Needed Relief Categories</h4>
                  <div className="autosuggest-needs-grid">
                    {Object.entries(b.needs).map(([key, val]) => (
                      <div key={key} className="autosuggest-need-item">
                        <span className="need-label">{CATEGORY_LABELS[key] || key}</span>
                        <span className="need-count">{val.count} affected</span>
                        {val.needs.filter(Boolean).length > 0 && (
                          <span className="need-desc">{val.needs.filter(Boolean).join('; ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {b.pending > 0 && (
                <div className="autosuggest-action">
                  <strong>Suggested Action:</strong> Send relief goods to <strong>{b.name}</strong> — {b.pending} pending request{b.pending > 1 ? 's' : ''} need{b.pending === 1 ? 's' : ''} immediate attention.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
