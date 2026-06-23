import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase.js'

export async function createUserProfile(uid, { email, displayName, location, role }) {
  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: displayName || '',
    location: location || '',
    role: role || 'Member',
    createdAt: serverTimestamp(),
  })
}

function resolveRole(email) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  return adminEmail && email === adminEmail ? 'Admin' : 'Member'
}

export async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName || '',
      role: resolveRole(user.email),
    })
  }
}

export function subscribeUsers(onData, onError) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, ...d.data() }))
      onData(list)
    },
    (err) => onError?.(err)
  )
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data()
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true })
}
