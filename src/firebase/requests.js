import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { syncFamilyFromRequest } from './families.js'

const COLLECTION = 'reliefRequests'

export const REQUEST_STATUSES = ['pending', 'in-progress', 'completed']

export const STATUS_LABELS = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

function mapRequestDoc(d) {
  const data = d.data()
  return {
    docId: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function generateRequestId() {
  return `REQ-${Date.now()}`
}

const CATEGORY_FIELDS = ['pregnantWomen', 'elders', 'pwd', 'childrenBelow7']

export const CATEGORY_LABELS = {
  pregnantWomen: 'Pregnant Women',
  elders: 'Elders',
  pwd: 'PWD',
  childrenBelow7: 'Children 7 & Below',
}

export async function createReliefRequest(
  {
    location,
    barangay,
    contactNumber,
    is4PsBeneficiary,
    houseOwnership,
    shelterDamage,
    description,
    requesterName,
    familyMembers,
    hasEvacuationCenter,
    categories,
    primaryNeed,
    primaryNeeds,
    assistiveDevice,
    repBirthDate,
    repAge,
    repSex,
    repCivilStatus,
    repOccupation,
    repMonthlyIncome,
    lat,
    lng,
  },
  user
) {
  const requestId = generateRequestId()
  const data = {
    requestId,
    location: (location || '').trim(),
    barangay: (barangay || '').trim(),
    contactNumber: (contactNumber || '').trim(),
    is4PsBeneficiary: !!is4PsBeneficiary,
    houseOwnership: houseOwnership || 'owner',
    shelterDamage: shelterDamage || 'none',
    lat: lat ?? null,
    lng: lng ?? null,
    description: (description || '').trim(),
    requesterName: (requesterName || '').trim(),
    familyMembers: Math.max(0, Number(familyMembers) || 0),
    hasEvacuationCenter: !!hasEvacuationCenter,
    primaryNeeds: Array.isArray(primaryNeeds) ? primaryNeeds : (primaryNeed ? [primaryNeed] : []),
    primaryNeed: (primaryNeed || (Array.isArray(primaryNeeds) ? primaryNeeds.join(', ') : '') || '').trim(),
    assistiveDevice: (assistiveDevice || '').trim(),
    repBirthDate: (repBirthDate || '').trim(),
    repAge: repAge ? (Number(repAge) || repAge) : '',
    repSex: (repSex || '').trim(),
    repCivilStatus: (repCivilStatus || '').trim(),
    repOccupation: (repOccupation || '').trim(),
    repMonthlyIncome: (repMonthlyIncome || '').trim(),
    categories: {},
    status: 'pending',
    createdBy: user.uid,
    createdByName: user.displayName || user.email?.split('@')[0] || 'User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  for (const key of CATEGORY_FIELDS) {
    const cat = categories?.[key]
    if (cat?.count || cat?.needs) {
      data.categories[key] = {
        count: Number(cat.count) || 0,
        needs: (cat.needs || '').trim(),
      }
    }
  }
  const ref = await addDoc(collection(db, COLLECTION), data)
  try {
    await syncFamilyFromRequest(
      {
        requestId,
        requesterName: data.requesterName,
        contactNumber: data.contactNumber,
        barangay: data.barangay,
        location: data.location,
        familyMembers: data.familyMembers,
        categories: data.categories,
        is4PsBeneficiary: data.is4PsBeneficiary,
        houseOwnership: data.houseOwnership,
        shelterDamage: data.shelterDamage,
        repBirthDate: data.repBirthDate,
        repAge: data.repAge,
        repSex: data.repSex,
        repCivilStatus: data.repCivilStatus,
        repOccupation: data.repOccupation,
        repMonthlyIncome: data.repMonthlyIncome,
        description: data.description,
      },
      user
    )
  } catch (syncErr) {
    console.error('Failed to auto-sync family to Beneficiaries:', syncErr)
  }
  return { docId: ref.id, requestId }
}

export async function getReliefRequests() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(mapRequestDoc)
}

export function subscribeReliefRequests(onData, onError, user) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapRequestDoc)
      if (user && user.role !== 'Admin') {
        onData(all.filter((r) => r.createdBy === user.uid))
      } else {
        onData(all)
      }
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function updateReliefRequestStatus(docId, status) {
  await updateDoc(doc(db, COLLECTION, docId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function updateReliefRequestCoordinates(docId, lat, lng) {
  await updateDoc(doc(db, COLLECTION, docId), { lat, lng, updatedAt: serverTimestamp() })
}

export async function deleteReliefRequest(docId) {
  await deleteDoc(doc(db, COLLECTION, docId))
}
