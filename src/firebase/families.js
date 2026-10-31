import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
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

export const ECONOMIC_STATUSES = [
  { id: 'lower-middle', label: 'Lower-Middle Class', description: 'Earning enough for basic needs plus a small extra buffer, often skilled workers or entry professionals.' },
  { id: 'middle', label: 'Middle Class', description: 'Earning stable mid-level incomes, able to afford regular comforts, housing, and education.' },
  { id: 'upper-middle', label: 'Upper-Middle Class', description: 'Earning high salaries as senior professionals or managers with strong financial security.' },
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
    economicStatus: fields.economicStatus || 'not-set',
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
  if (fields.economicStatus !== undefined) payload.economicStatus = fields.economicStatus
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

/**
 * Automatically synchronizes / registers an affected family in the Beneficiaries
 * Family Registry when a Relief Request is submitted.
 */
export async function syncFamilyFromRequest(fields, user) {
  const normHead = (fields.requesterName || fields.headOfFamily || '').trim()
  const nameParts = normHead.split(/\s+/)
  const normFamily = (fields.familyName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : normHead) || 'Family').trim()
  const normBrgy = (fields.barangay || '').trim()

  // Derive primary vulnerability classification
  let classification = 'none'
  if (Number(fields.categories?.pwd?.count) > 0) classification = 'pwd'
  else if (Number(fields.categories?.pregnantWomen?.count) > 0) classification = 'pregnant'
  else if (Number(fields.categories?.elders?.count) > 0) classification = 'elderly'
  else if (Number(fields.categories?.childrenBelow7?.count) > 0) classification = 'child'

  let existingId = null
  if (normBrgy && (normHead || normFamily)) {
    try {
      const q = query(collection(db, COLLECTION), where('barangay', '==', normBrgy))
      const snap = await getDocs(q)
      const found = snap.docs.find((d) => {
        const data = d.data()
        return (
          (data.headOfFamily && data.headOfFamily.toLowerCase() === normHead.toLowerCase()) ||
          (data.familyName && data.familyName.toLowerCase() === normFamily.toLowerCase())
        )
      })
      if (found) existingId = found.id
    } catch (err) {
      console.warn('Family lookup error, creating new record:', err)
    }
  }

  const payload = {
    familyName: normFamily,
    headOfFamily: normHead,
    contactNumber: (fields.contactNumber || '').trim(),
    barangay: normBrgy,
    location: (fields.location || '').trim(),
    members: Math.max(1, Number(fields.familyMembers || fields.members) || 1),
    classification,
    categories: fields.categories || {},
    is4PsBeneficiary: !!fields.is4PsBeneficiary,
    houseOwnership: fields.houseOwnership || 'owner',
    shelterDamage: fields.shelterDamage || 'none',
    repBirthDate: (fields.repBirthDate || '').trim(),
    repAge: fields.repAge ? (Number(fields.repAge) || fields.repAge) : '',
    repSex: (fields.repSex || '').trim(),
    repCivilStatus: (fields.repCivilStatus || '').trim(),
    repOccupation: (fields.repOccupation || '').trim(),
    repMonthlyIncome: (fields.repMonthlyIncome || '').trim(),
    latestRequestId: fields.requestId || '',
    updatedAt: serverTimestamp(),
  }

  if (existingId) {
    await updateDoc(doc(db, COLLECTION, existingId), payload)
    return { docId: existingId, isNew: false }
  } else {
    payload.economicStatus = fields.economicStatus || 'not-set'
    payload.notes = (fields.description || fields.notes || '').trim()
    payload.createdBy = user.uid
    payload.createdByName = user.displayName || user.email?.split('@')[0] || 'User'
    payload.createdAt = serverTimestamp()
    const ref = await addDoc(collection(db, COLLECTION), payload)
    return { docId: ref.id, isNew: true }
  }
}
