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
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase.js'

const COLLECTION = 'families'

export const CLASSIFICATIONS = [
  { id: 'pregnant', label: 'Pregnant Woman' },
  { id: 'elderly', label: 'Elderly' },
  { id: 'pwd', label: 'PWD' },
  { id: 'child', label: 'Child Below 7' },
  { id: 'solo-parent', label: 'Solo Parent' },
  { id: 'none', label: 'None' },
]

function mapDoc(d) {
  const data = d.data()
  return {
    docId: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

export async function createFamily(fields, user) {
  const ref = await addDoc(collection(db, COLLECTION), {
    familyName: fields.familyName.trim(),
    barangay: fields.barangay.trim(),
    headOfFamily: (fields.headOfFamily || '').trim(),
    contactNumber: (fields.contactNumber || '').trim(),
    members: Math.max(1, Number(fields.members) || 1),
    classification: fields.classification || 'none',
    notes: (fields.notes || '').trim(),
    createdBy: user.uid,
    createdByName: user.displayName || user.email?.split('@')[0] || 'User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { docId: ref.id }
}

export function subscribeFamilies(onData, onError, user) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapDoc)
      if (user && user.role !== 'Admin') {
        onData(all.filter((f) => f.createdBy === user.uid))
      } else {
        onData(all)
      }
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function updateFamily(docId, fields) {
  const payload = { updatedAt: serverTimestamp() }
  if (fields.familyName !== undefined) payload.familyName = fields.familyName.trim()
  if (fields.barangay !== undefined) payload.barangay = fields.barangay.trim()
  if (fields.headOfFamily !== undefined) payload.headOfFamily = (fields.headOfFamily || '').trim()
  if (fields.contactNumber !== undefined) payload.contactNumber = (fields.contactNumber || '').trim()
  if (fields.members !== undefined) payload.members = Math.max(1, Number(fields.members) || 1)
  if (fields.classification !== undefined) payload.classification = fields.classification
  if (fields.notes !== undefined) payload.notes = (fields.notes || '').trim()
  await updateDoc(doc(db, COLLECTION, docId), payload)
}

export async function deleteFamily(docId) {
  await deleteDoc(doc(db, COLLECTION, docId))
}

export async function getAllFamilies() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(mapDoc)
}
