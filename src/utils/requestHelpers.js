import { STATUS_LABELS } from '../firebase/requests'

export function formatRequestDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status
}

export function getStatusClass(status) {
  return status || 'pending'
}

export function countByStatus(requests) {
  return requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    { pending: 0, 'in-progress': 0, completed: 0 }
  )
}

export function formatShortAddress(address) {
  if (!address || typeof address !== 'string') return 'City of Naga'
  const clean = address
    .replace(/,?\s*\b(Central Visayas|Western Visayas|Eastern Visayas|Central Luzon|CALABARZON|MIMAROPA|Bicol Region|Ilocos Region|Cagayan Valley|Cordillera Administrative Region|Davao Region|SOCCSKSARGEN|Caraga|Bangsamoro|NCR|National Capital Region)\b/gi, '')
    .replace(/,?\s*\b(Philippines|Pilipinas)\b/gi, '')
    .replace(/,?\s*\b\d{4}\b/g, '')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/,\s*$/, '')
    .trim()
  return clean || address
}
