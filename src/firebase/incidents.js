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

const COLLECTION = 'disasterIncidents'

export const DISASTER_TYPES = [
  'Typhoon',
  'Flood',
  'Landslide',
  'Fire',
  'Earthquake',
  'Storm Surge',
  'Severe Weather',
  'Other',
]

export const SEVERITY_LEVELS = [
  'Critical',
  'Severe',
  'Moderate',
  'Minor',
]

export const INCIDENT_STATUSES = [
  'Active',
  'Contained',
  'Resolved',
]

export const NAGA_BARANGAYS_LIST = [
  'Alpaco',
  'Bairan',
  'Balirong',
  'Cabungahan',
  'Cantao-an',
  'Central Poblacion',
  'Cogon',
  'Colon',
  'East Poblacion',
  'Inayagan',
  'Inoburan',
  'Jaguimit',
  'Lanas',
  'Langtad',
  'Lutac',
  'Mainit',
  'Mayana',
  'Naalad',
  'North Poblacion',
  'Pangdan',
  'Patag',
  'South Poblacion',
  'Tagjaguimit',
  'Tangke',
  'Tinaan',
  'Tuyan',
  'Uling',
  'West Poblacion',
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

export function generateIncidentId() {
  const year = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `INC-${year}-${random}`
}

export async function createDisasterIncident(fields, user) {
  const incidentId = fields.incidentId || generateIncidentId()
  const ref = await addDoc(collection(db, COLLECTION), {
    incidentId,
    title: (fields.title || '').trim(),
    disasterType: fields.disasterType || 'Typhoon',
    incidentDate: fields.incidentDate || new Date().toISOString().slice(0, 10),
    incidentTime: fields.incidentTime || '',
    severity: fields.severity || 'Critical',
    status: fields.status || 'Active',
    affectedBarangays: Array.isArray(fields.affectedBarangays)
      ? fields.affectedBarangays
      : (fields.affectedBarangays ? [fields.affectedBarangays] : []),
    casualties: Math.max(0, Number(fields.casualties) || 0),
    injured: Math.max(0, Number(fields.injured) || 0),
    missing: Math.max(0, Number(fields.missing) || 0),
    displacedFamilies: Math.max(0, Number(fields.displacedFamilies) || 0),
    displacedIndividuals: Math.max(0, Number(fields.displacedIndividuals) || 0),
    evacuationCentersActive: Math.max(0, Number(fields.evacuationCentersActive) || 0),
    description: (fields.description || '').trim(),
    immediateNeeds: (fields.immediateNeeds || '').trim(),
    createdBy: user?.uid || 'system',
    createdByName: user?.displayName || user?.email?.split('@')[0] || 'Relief Officer',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { docId: ref.id, incidentId }
}

export function subscribeDisasterIncidents(onData, onError) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(mapDoc)),
    (err) => onError?.(err)
  )
}

export async function updateDisasterIncident(docId, fields) {
  const payload = { updatedAt: serverTimestamp() }
  if (fields.title !== undefined) payload.title = fields.title.trim()
  if (fields.disasterType !== undefined) payload.disasterType = fields.disasterType
  if (fields.incidentDate !== undefined) payload.incidentDate = fields.incidentDate
  if (fields.incidentTime !== undefined) payload.incidentTime = fields.incidentTime
  if (fields.severity !== undefined) payload.severity = fields.severity
  if (fields.status !== undefined) payload.status = fields.status
  if (fields.affectedBarangays !== undefined) payload.affectedBarangays = fields.affectedBarangays
  if (fields.casualties !== undefined) payload.casualties = Math.max(0, Number(fields.casualties) || 0)
  if (fields.injured !== undefined) payload.injured = Math.max(0, Number(fields.injured) || 0)
  if (fields.missing !== undefined) payload.missing = Math.max(0, Number(fields.missing) || 0)
  if (fields.displacedFamilies !== undefined) payload.displacedFamilies = Math.max(0, Number(fields.displacedFamilies) || 0)
  if (fields.displacedIndividuals !== undefined) payload.displacedIndividuals = Math.max(0, Number(fields.displacedIndividuals) || 0)
  if (fields.evacuationCentersActive !== undefined) payload.evacuationCentersActive = Math.max(0, Number(fields.evacuationCentersActive) || 0)
  if (fields.description !== undefined) payload.description = fields.description.trim()
  if (fields.immediateNeeds !== undefined) payload.immediateNeeds = fields.immediateNeeds.trim()

  await updateDoc(doc(db, COLLECTION, docId), payload)
}

export async function deleteDisasterIncident(docId) {
  await deleteDoc(doc(db, COLLECTION, docId))
}
