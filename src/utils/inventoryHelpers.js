import { CATEGORY_LABELS } from '../firebase/inventory'

export const LOW_STOCK_THRESHOLD = 10

export function formatInventoryDate(date) {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category
}

export function getCategoryClass(category) {
  return category || 'other'
}

export function isLowStock(quantity) {
  return typeof quantity === 'number' && quantity <= LOW_STOCK_THRESHOLD
}

export function countByCategory(items) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'other'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
}

export function countLowStock(items) {
  return items.filter((item) => isLowStock(item.quantity)).length
}
