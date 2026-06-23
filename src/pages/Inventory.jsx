import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../firebase/users'
import {
  createInventoryItem,
  subscribeInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  INVENTORY_CATEGORIES,
} from '../firebase/inventory'
import DashboardLayout from '../components/DashboardLayout'
import {
  formatInventoryDate,
  getCategoryLabel,
  getCategoryClass,
  isLowStock,
  countLowStock,
} from '../utils/inventoryHelpers'
import '../styles/Inventory.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'water', label: 'Water' },
  { id: 'medical', label: 'Medical' },
  { id: 'shelter', label: 'Shelter' },
  { id: 'other', label: 'Other' },
]

const EMPTY_FORM = {
  name: '',
  category: 'food',
  quantity: '',
  unit: '',
  storageLocation: '',
  notes: '',
}

export default function Inventory() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingDocId, setEditingDocId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [showReport, setShowReport] = useState(false)

  const isAdmin = profile?.role === 'Admin'
  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    setLoading(true)
    setError('')
    const unsubscribe = subscribeInventoryItems(
      (data) => {
        setItems(data)
        setLoading(false)
        setError('')
      },
      (err) => {
        setError(err.message || 'Failed to load inventory from Firestore.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  const filtered =
    filter === 'all' ? items : items.filter((item) => item.category === filter)

  const lowStockCount = countLowStock(items)

  const openAddForm = () => {
    setEditingDocId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (item) => {
    setEditingDocId(item.docId)
    setForm({
      name: item.name || '',
      category: item.category || 'food',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || '',
      storageLocation: item.storageLocation || '',
      notes: item.notes || '',
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
    const qty = Number(form.quantity)
    if (!form.name.trim()) return
    if (Number.isNaN(qty) || qty < 0) {
      setError('Quantity must be a number greater than or equal to 0.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        category: form.category,
        quantity: qty,
        unit: form.unit,
        storageLocation: form.storageLocation,
        notes: form.notes,
      }
      if (editingDocId) {
        await updateInventoryItem(editingDocId, payload)
      } else {
        await createInventoryItem(payload, user)
      }
      closeForm()
    } catch (err) {
      setError(err.message || 'Failed to save inventory item.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this inventory item?')) return
    setActionId(docId)
    setError('')
    try {
      await deleteInventoryItem(docId)
    } catch (err) {
      setError(err.message || 'Failed to delete item.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <DashboardLayout title="Inventory" userLabel={displayName} userEmail={email}>
      <div className="requests-header">
        <div className="requests-header-text">
          <h2>Relief supplies</h2>
          <p>Track food, water, medical kits, and other aid stock in real time.</p>
        </div>
        <div className="requests-header-actions">
          <button type="button" className="requests-btn-secondary" onClick={() => setShowReport(true)}>
            📄 Report
          </button>
          {isAdmin && (
            <button type="button" className="requests-btn-primary" onClick={openAddForm}>
              + Add item
            </button>
          )}
        </div>
      </div>

      {error && <div className="requests-error">{error}</div>}

      {!loading && !error && items.length > 0 && (
        <div className="inventory-summary">
          <span className="inventory-summary-chip">
            Total items: <strong>{items.length}</strong>
          </span>
          <span
            className={`inventory-summary-chip${lowStockCount > 0 ? ' low-stock' : ''}`}
          >
            Low stock: <strong>{lowStockCount}</strong>
          </span>
        </div>
      )}

      <div className="requests-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`requests-filter-tab ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="dashboard-activity">
        {loading && !error ? (
          <p className="requests-loading">Loading inventory...</p>
        ) : error && items.length === 0 ? (
          <p className="dashboard-empty">
            Unable to load inventory. Check Firestore rules and try again.
          </p>
        ) : filtered.length === 0 ? (
          <p className="dashboard-empty">
            {filter === 'all'
              ? 'No inventory items yet. Add your first item.'
              : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} items.`}
          </p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Storage</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.docId}>
                  <td>{row.itemId}</td>
                  <td>{row.name}</td>
                  <td>
                    <span
                      className={`inventory-category-badge ${getCategoryClass(row.category)}`}
                    >
                      {getCategoryLabel(row.category)}
                    </span>
                  </td>
                  <td className={isLowStock(row.quantity) ? 'inventory-qty-low' : ''}>
                    {row.quantity}
                  </td>
                  <td>{row.unit || '—'}</td>
                  <td>{row.storageLocation || '—'}</td>
                  <td>{formatInventoryDate(row.updatedAt || row.createdAt)}</td>
                  <td>
                    {isAdmin ? (
                      <>
                        <button
                          type="button"
                          className="inventory-edit-btn"
                          disabled={actionId === row.docId}
                          onClick={() => openEditForm(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="requests-delete-btn"
                          disabled={actionId === row.docId}
                          onClick={() => handleDelete(row.docId)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="inventory-viewonly-label">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="requests-modal-overlay" onClick={closeForm}>
          <div
            className="requests-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editingDocId ? 'Edit inventory item' : 'Add inventory item'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="requests-form-field">
                <label htmlFor="inv-name">Name</label>
                <input
                  id="inv-name"
                  type="text"
                  placeholder="e.g. Rice sacks"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={saving}
                />
              </div>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="inv-category">Category</label>
                  <select
                    id="inv-category"
                    className="requests-status-select"
                    style={{ width: '100%' }}
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    disabled={saving}
                  >
                    {INVENTORY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {getCategoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="requests-form-field">
                  <label htmlFor="inv-quantity">Quantity</label>
                  <input
                    id="inv-quantity"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="inventory-form-row">
                <div className="requests-form-field">
                  <label htmlFor="inv-unit">Unit</label>
                  <input
                    id="inv-unit"
                    type="text"
                    placeholder="e.g. boxes, kg"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="requests-form-field">
                  <label htmlFor="inv-storage">Storage location</label>
                  <input
                    id="inv-storage"
                    type="text"
                    placeholder="e.g. Warehouse A"
                    value={form.storageLocation}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, storageLocation: e.target.value }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="requests-form-field">
                <label htmlFor="inv-notes">Notes (optional)</label>
                <textarea
                  id="inv-notes"
                  placeholder="Expiry, supplier, etc."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="requests-modal-actions">
                <button
                  type="button"
                  className="requests-btn-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="requests-btn-primary" disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : editingDocId
                      ? 'Save changes'
                      : 'Add item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReport && (
        <div className="requests-modal-overlay" onClick={() => setShowReport(false)}>
          <div
            className="requests-modal inventory-report-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory-report">
              <div className="inventory-report-header">
                <div>
                  <h3>Inventory Report</h3>
                  <p>Generated {new Date().toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  className="requests-btn-primary"
                  onClick={() => window.print()}
                >
                  🖨️ Print
                </button>
              </div>

              <div className="inventory-report-summary">
                <div className="irs-item"><span>Total Items</span><strong>{items.length}</strong></div>
                <div className="irs-item"><span>Total Quantity</span><strong>{items.reduce((s, i) => s + (i.quantity || 0), 0)}</strong></div>
                <div className="irs-item"><span>Categories</span><strong>{new Set(items.map((i) => i.category)).size}</strong></div>
                <div className="irs-item warn"><span>Low Stock</span><strong>{lowStockCount}</strong></div>
              </div>

              {INVENTORY_CATEGORIES.map((cat) => {
                const catItems = items.filter((i) => i.category === cat)
                if (catItems.length === 0) return null
                const catQty = catItems.reduce((s, i) => s + (i.quantity || 0), 0)
                return (
                  <div key={cat} className="inventory-report-section">
                    <h4>{getCategoryLabel(cat)} <span>({catItems.length} items, {catQty} total)</span></h4>
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Item ID</th>
                          <th>Name</th>
                          <th>Quantity</th>
                          <th>Unit</th>
                          <th>Location</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((row) => (
                          <tr key={row.docId}>
                            <td>{row.itemId}</td>
                            <td>{row.name}</td>
                            <td className={isLowStock(row.quantity) ? 'inventory-qty-low' : ''}>{row.quantity}</td>
                            <td>{row.unit || '—'}</td>
                            <td>{row.storageLocation || '—'}</td>
                            <td>{formatInventoryDate(row.updatedAt || row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              {lowStockCount > 0 && (
                <div className="inventory-report-section warn">
                  <h4>⚠️ Low Stock Alert</h4>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.filter((i) => isLowStock(i.quantity)).map((row) => (
                        <tr key={row.docId}>
                          <td>{row.itemId}</td>
                          <td>{row.name}</td>
                          <td>{getCategoryLabel(row.category)}</td>
                          <td className="inventory-qty-low">{row.quantity}</td>
                          <td>{row.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
