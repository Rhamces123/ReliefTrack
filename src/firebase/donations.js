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

const COLLECTION = 'donations'

function mapDoc(d) {
  const data = d.data()
  return {
    docId: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

export async function createDonation({ agency, type, items, quantity, unit, notes }, user) {
  const ref = await addDoc(collection(db, COLLECTION), {
    agency: agency.trim(),
    type,
    items: (items || '').trim(),
    quantity: Math.max(0, Number(quantity) || 0),
    unit: (unit || '').trim(),
    notes: (notes || '').trim(),
    createdBy: user.uid,
    createdByName: user.displayName || user.email?.split('@')[0] || 'User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { docId: ref.id }
}

export function subscribeDonations(onData, onError) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(mapDoc)),
    (err) => onError?.(err)
  )
}

export async function updateDonation(docId, fields) {
  const payload = { updatedAt: serverTimestamp() }
  if (fields.agency !== undefined) payload.agency = fields.agency.trim()
  if (fields.type !== undefined) payload.type = fields.type
  if (fields.items !== undefined) payload.items = fields.items.trim()
  if (fields.quantity !== undefined) payload.quantity = Math.max(0, Number(fields.quantity) || 0)
  if (fields.unit !== undefined) payload.unit = (fields.unit || '').trim()
  if (fields.notes !== undefined) payload.notes = (fields.notes || '').trim()
  await updateDoc(doc(db, COLLECTION, docId), payload)
}

export async function deleteDonation(docId) {
  await deleteDoc(doc(db, COLLECTION, docId))
}
