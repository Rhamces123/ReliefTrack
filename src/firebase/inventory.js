import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'

const COLLECTION = 'inventoryItems'

export const INVENTORY_CATEGORIES = [
  'food',
  'water',
  'medical',
  'shelter',
  'other',
]

export const CATEGORY_LABELS = {
  food: 'Food',
  water: 'Water',
  medical: 'Medical',
  shelter: 'Shelter',
  other: 'Other',
}

function mapInventoryDoc(d) {
  const data = d.data()
  return {
    docId: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function generateItemId() {
  return `INV-${Date.now()}`
}

export async function createInventoryItem(
  { name, category, quantity, unit, storageLocation, notes },
  user
) {
  const itemId = generateItemId()
  const ref = await addDoc(collection(db, COLLECTION), {
    itemId,
    name: name.trim(),
    category,
    quantity: Number(quantity),
    unit: (unit || '').trim(),
    storageLocation: (storageLocation || '').trim(),
    notes: (notes || '').trim(),
    createdBy: user.uid,
    createdByName: user.displayName || user.email?.split('@')[0] || 'User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { docId: ref.id, itemId }
}

export function subscribeInventoryItems(onData, onError) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map(mapInventoryDoc))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function updateInventoryItem(docId, fields) {
  const payload = {
    updatedAt: serverTimestamp(),
  }
  if (fields.name !== undefined) payload.name = fields.name.trim()
  if (fields.category !== undefined) payload.category = fields.category
  if (fields.quantity !== undefined) payload.quantity = Number(fields.quantity)
  if (fields.unit !== undefined) payload.unit = (fields.unit || '').trim()
  if (fields.storageLocation !== undefined) {
    payload.storageLocation = (fields.storageLocation || '').trim()
  }
  if (fields.notes !== undefined) payload.notes = (fields.notes || '').trim()
  await updateDoc(doc(db, COLLECTION, docId), payload)
}

export async function deleteInventoryItem(docId) {
  await deleteDoc(doc(db, COLLECTION, docId))
}
