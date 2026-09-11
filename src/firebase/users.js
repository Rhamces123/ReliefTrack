import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase.js'

export async function createUserProfile(uid, { email, displayName, location, role, status }) {
  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: displayName || '',
    location: location || '',
    role: role || 'Member',
    status: status || 'Active',
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
      status: 'Active',
    })
  } else {
    const data = snap.data()
    if (!data.status) {
      await setDoc(ref, { status: 'Active' }, { merge: true })
    }
  }
}

export function subscribeUsers(onData, onError) {
  const colRef = collection(db, 'users')
  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data()
        return {
          docId: d.id,
          status: data.status || 'Active',
          role: data.role || 'Member',
          ...data,
        }
      })
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
        if (timeA && timeB) return timeB - timeA
        return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
      })
      onData(list)
    },
    (err) => {
      console.error('Error in subscribeUsers:', err)
      onError?.(err)
    }
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

export async function setUserStatus(uid, status) {
  await setDoc(doc(db, 'users', uid), { status }, { merge: true })
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, 'users', uid))
}

