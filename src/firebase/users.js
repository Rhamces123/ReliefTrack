import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, onSnapshot,
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { db, firebaseConfig } from '../firebase.js'

export const INITIAL_AUTH_USERS = [
  {
    email: 'iyasjessa1@gmail.com',
    displayName: 'Jessa Iyas',
    location: 'Cebu City, Central Visayas',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T10:00:00Z'),
    lastActiveAt: new Date('2026-09-05T14:30:00Z'),
    isOnline: false,
  },
  {
    email: 'iyasjessa22@gmail.com',
    displayName: 'Jessa Iyas (Alt)',
    location: 'Mandaue City, Central Visayas',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T11:00:00Z'),
    lastActiveAt: new Date('2026-09-02T11:15:00Z'),
    isOnline: false,
  },
  {
    email: 'algarmeria@gmail.com',
    displayName: 'Al Garmeria',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T09:00:00Z'),
    lastActiveAt: new Date('2026-09-02T09:20:00Z'),
    isOnline: false,
  },
  {
    email: 'ponce.cassandrajade1@gmail.com',
    displayName: 'Cassandra Jade Ponce',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T08:00:00Z'),
    lastActiveAt: new Date('2026-08-23T08:30:00Z'),
    isOnline: false,
  },
  {
    email: 'marinarcblnca@gmail.com',
    displayName: 'Marina Blanca',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T08:15:00Z'),
    lastActiveAt: new Date('2026-08-23T08:45:00Z'),
    isOnline: false,
  },
  {
    email: 'requintoriagrace@gmail.com',
    displayName: 'Grace Requintoria',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T09:00:00Z'),
    lastActiveAt: new Date('2026-08-23T09:30:00Z'),
    isOnline: false,
  },
  {
    email: 'keithabalo03@gmail.com',
    displayName: 'Keith Abalo',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T10:00:00Z'),
    lastActiveAt: new Date('2026-08-23T10:20:00Z'),
    isOnline: false,
  },
  {
    email: 'cpecidas@gmail.com',
    displayName: 'C Pecidas',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T11:00:00Z'),
    lastActiveAt: new Date('2026-09-08T16:00:00Z'),
    isOnline: false,
  },
  {
    email: 'futureniya02@gmail.com',
    displayName: 'Future Niya',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-22T08:00:00Z'),
    lastActiveAt: new Date('2026-08-22T08:30:00Z'),
    isOnline: false,
  },
  {
    email: 'karljosephmalayao@gmail.com',
    displayName: 'Karl Joseph Malayao',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-03T09:00:00Z'),
    lastActiveAt: new Date('2026-08-03T09:15:00Z'),
    isOnline: false,
  },
  {
    email: 'keithabalo02@gmail.com',
    displayName: 'Keith Abalo (Alt)',
    location: 'Naga, Camarines Sur',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-07-11T08:00:00Z'),
    lastActiveAt: new Date('2026-07-11T08:20:00Z'),
    isOnline: false,
  },
]

export function formatDisplayNameFromEmail(email) {
  if (!email) return 'User'
  const namePart = email.split('@')[0].replace(/[._-]+/g, ' ')
  return namePart.replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function createUserProfile(uid, { email, displayName, location, role, status, isOnline, lastActiveAt, createdAt }) {
  const resolvedName = displayName || (email ? formatDisplayNameFromEmail(email) : 'User')
  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: resolvedName,
    location: location || '',
    role: role || 'Member',
    status: status || 'Active',
    isOnline: isOnline !== undefined ? !!isOnline : true,
    lastActiveAt: lastActiveAt || serverTimestamp(),
    createdAt: createdAt || serverTimestamp(),
  }, { merge: true })
}

function resolveRole(email) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  return adminEmail && email === adminEmail ? 'Admin' : 'Member'
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    let existingMeta = {}
    if (user.email) {
      const placeholderId = `user_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`
      if (placeholderId !== user.uid) {
        try {
          const placeholderRef = doc(db, 'users', placeholderId)
          const pSnap = await getDoc(placeholderRef)
          if (pSnap.exists()) {
            existingMeta = pSnap.data() || {}
            // Clean up placeholder to prevent duplicate rows in User Management
            await deleteDoc(placeholderRef).catch(() => {})
          }
        } catch {
          // ignore placeholder lookup errors
        }
      }
    }

    const resolvedName = user.displayName || existingMeta.displayName || formatDisplayNameFromEmail(user.email)
    const resolvedRole = existingMeta.role || resolveRole(user.email)
    const resolvedLocation = existingMeta.location || ''
    const resolvedStatus = existingMeta.status || 'Active'

    await createUserProfile(user.uid, {
      email: user.email,
      displayName: resolvedName,
      location: resolvedLocation,
      role: resolvedRole,
      status: resolvedStatus,
      isOnline: true,
      lastActiveAt: serverTimestamp(),
      createdAt: existingMeta.createdAt || serverTimestamp(),
    })
  } else {
    await setDoc(ref, {
      status: snap.data().status || 'Active',
      isOnline: true,
      lastActiveAt: serverTimestamp(),
    }, { merge: true })
  }
}

export async function syncAuthUsersToFirestore(existingUsers = []) {
  const existingEmails = new Set(
    existingUsers.map((u) => u.email?.toLowerCase().trim()).filter(Boolean)
  )

  let syncedCount = 0
  for (const account of INITIAL_AUTH_USERS) {
    if (!existingEmails.has(account.email.toLowerCase().trim())) {
      // Create a clean document ID based on email prefix
      const docId = `user_${account.email.replace(/[^a-zA-Z0-9]/g, '_')}`
      await setDoc(doc(db, 'users', docId), {
        email: account.email,
        displayName: account.displayName,
        location: account.location,
        role: account.role,
        status: account.status,
        isOnline: account.isOnline,
        lastActiveAt: account.lastActiveAt,
        createdAt: account.createdAt,
      }, { merge: true })
      syncedCount++
    }
  }
  return syncedCount
}

export async function setUserPresence(uid, isOnline) {
  if (!uid) return
  await setDoc(doc(db, 'users', uid), {
    isOnline,
    lastActiveAt: serverTimestamp(),
  }, { merge: true })
}

export async function registerAccountFromAdmin({ email, password, displayName, name, location, role }) {
  const resolvedEmail = (email || '').trim()
  if (!resolvedEmail) throw new Error('Email address is required.')

  const resolvedName = (displayName || name || '').trim() || formatDisplayNameFromEmail(resolvedEmail)
  const resolvedLocation = (location || '').trim()
  const resolvedRole = role || 'Member'
  const resolvedPassword = password ? password.trim() : ''

  let authUid = null

  if (resolvedPassword && resolvedPassword.length >= 6) {
    try {
      // Use secondary app to prevent signing out the current admin
      const secondaryName = 'ReliefTrackSecondaryAuth'
      const existing = getApps().find((a) => a.name === secondaryName)
      const secondaryApp = existing || initializeApp(firebaseConfig, secondaryName)
      const secondaryAuth = getAuth(secondaryApp)

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, resolvedEmail, resolvedPassword)
      const newUser = userCredential.user
      authUid = newUser.uid

      if (resolvedName) {
        await updateProfile(newUser, { displayName: resolvedName })
      }

      await signOut(secondaryAuth)
    } catch (authErr) {
      if (authErr.code !== 'auth/email-already-in-use') {
        throw authErr
      }
      // If email already in use in Firebase Auth, proceed to link/create Firestore record
    }
  }

  // Create document in Firestore
  const docId = authUid || `user_${resolvedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`
  await setDoc(doc(db, 'users', docId), {
    email: resolvedEmail,
    displayName: resolvedName,
    location: resolvedLocation,
    role: resolvedRole,
    status: 'Active',
    isOnline: false,
    lastActiveAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })

  return { docId, email: resolvedEmail, displayName: resolvedName, hasAuth: !!authUid }
}

export async function addUserAccount(data) {
  return registerAccountFromAdmin(data)
}

export function subscribeUsers(onData, onError) {
  const colRef = collection(db, 'users')
  return onSnapshot(
    colRef,
    (snap) => {
      const rawList = snap.docs.map((d) => {
        const data = d.data()
        return {
          docId: d.id,
          status: data.status || 'Active',
          role: data.role || 'Member',
          ...data,
        }
      })

      // Deduplicate by lowercase email so each account appears exactly once
      const byEmail = new Map()
      for (const u of rawList) {
        const key = (u.email || u.docId).toLowerCase().trim()
        if (!byEmail.has(key)) {
          byEmail.set(key, u)
        } else {
          const existing = byEmail.get(key)
          // Prefer doc that has an actual Firebase Auth UID (doesn't start with user_)
          const existingIsPlaceholder = existing.docId.startsWith('user_')
          const currentIsPlaceholder = u.docId.startsWith('user_')
          if (existingIsPlaceholder && !currentIsPlaceholder) {
            byEmail.set(key, { ...existing, ...u })
          } else if (u.isOnline && !existing.isOnline) {
            byEmail.set(key, { ...existing, ...u })
          }
        }
      }

      const list = Array.from(byEmail.values())
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

