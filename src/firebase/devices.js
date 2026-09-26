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

export async function createDeviceRecord(uid, deviceId, fingerprintHash, approvalToken, isTrusted = false) {
  const now = serverTimestamp()
  const ref = getDeviceDocRef(uid, deviceId)
  await setDoc(ref, {
    deviceId,
    fingerprintHash,
    browser: getBrowserName(),
    operatingSystem: getOsName(),
    deviceName: `${getBrowserName()} • ${getOsName()}`,
    isTrusted: !!isTrusted,
    rejected: false,
    approvalToken: isTrusted ? null : (approvalToken || null),
    processedAt: isTrusted ? now : null,
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

export async function approveDeviceRecord(uid, deviceId, approvalToken) {
  await updateDoc(getDeviceDocRef(uid, deviceId), {
    isTrusted: true,
    rejected: false,
    approvalToken: approvalToken || null,
    processedAt: serverTimestamp(),
  })
}

export async function removeDevice(uid, deviceId) {
  await deleteDoc(getDeviceDocRef(uid, deviceId))
}

/**
 * Check whether the current session represents a newly created account.
 * Accounts just created on this device should not ask for device approval.
 */
export function checkIsNewAccount(firebaseUser) {
  // 1. Session storage flag set during sign up on this device
  try {
    const flag = sessionStorage.getItem('relieftrack_new_signup')
    if (flag === 'true' || (firebaseUser?.uid && flag === firebaseUser.uid)) {
      return true
    }
  } catch {
    // sessionStorage may be disabled/restricted
  }

  // 2. Firebase Auth metadata check: when newly created, creationTime === lastSignInTime (within 45s)
  if (firebaseUser?.metadata?.creationTime && firebaseUser?.metadata?.lastSignInTime) {
    const cTime = new Date(firebaseUser.metadata.creationTime).getTime()
    const sTime = new Date(firebaseUser.metadata.lastSignInTime).getTime()
    if (!isNaN(cTime) && !isNaN(sTime)) {
      if (Math.abs(sTime - cTime) < 45000) {
        return true
      }
    }
  }

  return false
}

/**
 * Core verification logic used right after auth state changes.
 * The persistent device token (localStorage) is the SOLE identity key:
 * clearing storage, incognito, another browser, or another machine all
 * produce a fresh token and are therefore treated as a NEW device.
 *
 * Rule:
 *  - If NEW account created: automatically trust this initial device (no approval request).
 *  - If account ALREADY created and logs into a NEW device: request device approval via email.
 *
 * Returns one of:
 *  - { status: 'trusted', deviceId }                 -> known & trusted token
 *  - { status: 'pending', deviceId, approvalToken }  -> needs email approval
 */
export async function evaluateDevice(uid, firebaseUser = null) {
  const deviceId = getDeviceId()
  const fingerprint = await buildFingerprint()
  let existing = await findDeviceById(uid, deviceId)

  // Old records created before the email-approval flow have no token and
  // can never be approved, so rebuild them with a fresh approval token.
  if (existing && !existing.isTrusted && !existing.approvalToken) {
    await removeDevice(uid, deviceId)
    existing = null
  }

  const existingDevices = await listDevices(uid)
  const isNew = checkIsNewAccount(firebaseUser)

  if (existing) {
    await updateDeviceLogin(uid, deviceId)
    if (existing.isTrusted) {
      return { status: 'trusted', deviceId }
    }

    // If an existing device record was saved as untrusted during new account creation
    // and there are no other devices, auto-trust it now for the new account.
    if (isNew && existingDevices.length <= 1) {
      await approveDeviceRecord(uid, deviceId, existing.approvalToken || generateApprovalToken())
      try {
        sessionStorage.removeItem('relieftrack_new_signup')
      } catch {}
      return { status: 'trusted', deviceId }
    }

    return { status: 'pending', deviceId, approvalToken: existing.approvalToken }
  }

  // Device is not yet recognized.
  // If this is a newly created account on its initial device, automatically trust it.
  if (isNew && existingDevices.length === 0) {
    await createDeviceRecord(uid, deviceId, fingerprint, null, true)
    try {
      sessionStorage.removeItem('relieftrack_new_signup')
    } catch {}
    return { status: 'trusted', deviceId }
  }

  // If the account was ALREADY created and is logging into a newly detected device,
  // request approval via email.
  const approvalToken = generateApprovalToken()
  const { id } = await createDeviceRecord(uid, deviceId, fingerprint, approvalToken, false)
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