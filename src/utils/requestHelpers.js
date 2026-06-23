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
