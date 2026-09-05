import {
  doc, getDocs, getDoc, query, where, updateDoc, deleteDoc, setDoc, collection, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'

const DEVICE_ID_KEY = 'relieftrack_device_id'
const KS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function generateDeviceId() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => KS[b % KS.length]).join('')
}

export function generateApprovalToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getDeviceDocRef(uid, deviceId) {
  return doc(collection(db, `users/${uid}/knownDevices`), deviceId)
}

export function getBrowserName() {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome'
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/MSIE|Trident/.test(ua)) return 'Internet Explorer'
  return 'Unknown browser'
}

export function getOsName() {
  const ua = navigator.userAgent
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1'
  if (/Windows NT 6\.2/.test(ua)) return 'Windows 8'
  if (/Windows NT 6\.1/.test(ua)) return 'Windows 7'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown OS'
}

async function buildFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language || '',
    window.screen.width + 'x' + window.screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.hardwareConcurrency || '',
  ].join('|')
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function deviceCollection(uid) {
  return collection(db, `users/${uid}/knownDevices`)
}

export async function findDeviceByFingerprint(uid, fingerprint) {
  const q = query(deviceCollection(uid), where('fingerprintHash', '==', fingerprint))
  const snap = await getDocs(q)
  return snap.empty ? null : snap.docs[0]
}

export async function findDeviceById(uid, deviceId) {
  const snap = await getDoc(getDeviceDocRef(uid, deviceId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function listDevices(uid) {
  const snap = await getDocs(deviceCollection(uid))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createDeviceRecord(uid, deviceId, fingerprintHash, approvalToken) {
  const now = serverTimestamp()
  const ref = getDeviceDocRef(uid, deviceId)
  await setDoc(ref, {
    deviceId,
    fingerprintHash,
    browser: getBrowserName(),
    operatingSystem: getOsName(),
    deviceName: `${getBrowserName()} • ${getOsName()}`,
    isTrusted: false,
    rejected: false,
    approvalToken,
    processedAt: null,
    createdAt: now,
    lastLogin: now,
  })
  return { id: ref.id, fingerprintHash }
}

export async function updateDeviceLogin(uid, deviceId) {
  await updateDoc(getDeviceDocRef(uid, deviceId), {
    lastLogin: serverTimestamp(),
  })
}

export async function removeDevice(uid, deviceId) {
  await deleteDoc(getDeviceDocRef(uid, deviceId))
}

/**
 * Core verification logic used right after auth state changes.
 * The persistent device token (localStorage) is the SOLE identity key:
 * clearing storage, incognito, another browser, or another machine all
 * produce a fresh token and are therefore treated as a NEW device.
 *
 * Returns one of:
 *  - { status: 'trusted', deviceId }                 -> known & trusted token
 *  - { status: 'pending', deviceId, approvalToken }  -> needs email approval
 */
export async function evaluateDevice(uid) {
  const deviceId = getDeviceId()
  const fingerprint = await buildFingerprint()
  let existing = await findDeviceById(uid, deviceId)

  // Old records created before the email-approval flow have no token and
  // can never be approved, so rebuild them with a fresh approval token.
  if (existing && !existing.isTrusted && !existing.approvalToken) {
    await removeDevice(uid, deviceId)
    existing = null
  }

  if (existing) {
    await updateDeviceLogin(uid, deviceId)
    if (existing.isTrusted) {
      return { status: 'trusted', deviceId }
    }
    return { status: 'pending', deviceId, approvalToken: existing.approvalToken }
  }

  const approvalToken = generateApprovalToken()
  const { id } = await createDeviceRecord(uid, deviceId, fingerprint, approvalToken)
  return { status: 'pending', deviceId: id, approvalToken }
}

export async function sendDeviceApprovalEmail({
  recipient,
  displayName,
  deviceLabel,
  location,
  timeLabel,
  approveUrl,
  rejectUrl,
}) {
  const res = await fetch('/api/device-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient,
      displayName,
      deviceLabel,
      location,
      timeLabel,
      approveUrl,
      rejectUrl,
    }),
  })
  if (!res.ok) throw new Error('Failed to send approval email')
}