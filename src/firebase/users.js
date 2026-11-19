import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, onSnapshot, query, where, getDocs,
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { db, firebaseConfig, functions } from '../firebase.js'

export const INITIAL_AUTH_USERS = [
  {
    email: 'admin@relieftrack.com',
    displayName: 'System Admin',
    location: 'Naga EOC, City of Naga, Cebu',
    role: 'Admin',
    status: 'Active',
    createdAt: new Date('2026-07-01T08:00:00Z'),
    lastActiveAt: new Date(),
    isOnline: true,
  },
  {
    email: 'iyasjessa1@gmail.com',
    displayName: 'Jessa Iyas',
    location: 'Brgy. Central Poblacion, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T10:00:00Z'),
    lastActiveAt: new Date('2026-09-05T14:30:00Z'),
    isOnline: false,
  },
  {
    email: 'iyasjessa22@gmail.com',
    displayName: 'Jessa Iyas (Alt)',
    location: 'Brgy. Inoburan, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T11:00:00Z'),
    lastActiveAt: new Date('2026-09-02T11:15:00Z'),
    isOnline: false,
  },
  {
    email: 'algarmeria@gmail.com',
    displayName: 'Al Garmeria',
    location: 'Brgy. Colon, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-09-02T09:00:00Z'),
    lastActiveAt: new Date('2026-09-02T09:20:00Z'),
    isOnline: false,
  },
  {
    email: 'ponce.cassandrajade1@gmail.com',
    displayName: 'Cassandra Jade Ponce',
    location: 'Brgy. Tinaan, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T08:00:00Z'),
    lastActiveAt: new Date('2026-08-23T08:30:00Z'),
    isOnline: false,
  },
  {
    email: 'marinarcblnca@gmail.com',
    displayName: 'Marina Blanca',
    location: 'Brgy. Mainit, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T08:15:00Z'),
    lastActiveAt: new Date('2026-08-23T08:45:00Z'),
    isOnline: false,
  },
  {
    email: 'requintoriagrace@gmail.com',
    displayName: 'Grace Requintoria',
    location: 'Brgy. Pangdan, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T09:00:00Z'),
    lastActiveAt: new Date('2026-08-23T09:30:00Z'),
    isOnline: false,
  },
  {
    email: 'keithabalo03@gmail.com',
    displayName: 'Keith Abalo',
    location: 'Brgy. Cantao-an, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T10:00:00Z'),
    lastActiveAt: new Date('2026-08-23T10:20:00Z'),
    isOnline: false,
  },
  {
    email: 'cpecidas@gmail.com',
    displayName: 'C Pecidas',
    location: 'Brgy. Lutac, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-23T11:00:00Z'),
    lastActiveAt: new Date('2026-09-08T16:00:00Z'),
    isOnline: false,
  },
  {
    email: 'futureniya02@gmail.com',
    displayName: 'Future Niya',
    location: 'Brgy. Uling, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-22T08:00:00Z'),
    lastActiveAt: new Date('2026-08-22T08:30:00Z'),
    isOnline: false,
  },
  {
    email: 'karljosephmalayao@gmail.com',
    displayName: 'Karl Joseph Malayao',
    location: 'Brgy. North Poblacion, City of Naga, Cebu',
    role: 'Member',
    status: 'Active',
    createdAt: new Date('2026-08-03T09:00:00Z'),
    lastActiveAt: new Date('2026-08-03T09:15:00Z'),
    isOnline: false,
  },
  {
    email: 'keithabalo02@gmail.com',
    displayName: 'Keith Abalo (Alt)',
    location: 'Brgy. Tuyan, City of Naga, Cebu',
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
    const snapData = snap.data() || {}
    let resolvedStatus = snapData.status || 'Active'
    if (resolvedStatus !== 'On Hold' && resolvedStatus !== 'Deleted' && user.email) {
      const placeholderId = `user_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`
      try {
        const placeholderRef = doc(db, 'users', placeholderId)
        const pSnap = await getDoc(placeholderRef)
        if (pSnap.exists()) {
          const pStatus = pSnap.data().status
          if (pStatus === 'Deleted' || pStatus === 'On Hold') {
            resolvedStatus = pStatus
          }
        }
      } catch {
        // ignore
      }
    }
    const isAdminEmail =
      user.email &&
      import.meta.env.VITE_ADMIN_EMAIL &&
      user.email.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL.toLowerCase()
    await setDoc(ref, {
      status: resolvedStatus,
      role: isAdminEmail ? 'Admin' : (snapData.role || 'Member'),
      isOnline: resolvedStatus !== 'On Hold' && resolvedStatus !== 'Deleted',
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

  if (resolvedPassword && resolvedPassword.length >= 8) {
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
  let deletedEmails = new Set()
  let cachedSnap = null

  const emitList = () => {
    if (!cachedSnap) return

    const firestoreDocs = cachedSnap.docs.map((d) => {
      const data = d.data()
      return {
        docId: d.id,
        status: data.status || 'Active',
        role: data.role || 'Member',
        ...data,
      }
    })

    // Start with pre-seeded accounts, skipping any that were deleted
    const userMap = new Map()
    for (const account of INITIAL_AUTH_USERS) {
      const key = account.email.toLowerCase().trim()
      if (deletedEmails.has(key)) continue
      userMap.set(key, {
        docId: `user_${account.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        ...account,
      })
    }

    // Merge Firestore documents (overrides defaults with live state & includes new accounts)
    for (const fDoc of firestoreDocs) {
      const docEmail = (fDoc.email || '').toLowerCase().trim()
      if (docEmail && deletedEmails.has(docEmail)) continue
      if (fDoc.status === 'Deleted') continue

      const key = docEmail || fDoc.docId.toLowerCase().trim()

      let targetKey = key
      if (!userMap.has(targetKey) && docEmail) {
        for (const [mKey, existing] of userMap.entries()) {
          if (existing.email && existing.email.toLowerCase().trim() === docEmail) {
            targetKey = mKey
            break
          }
        }
      }

      if (userMap.has(targetKey)) {
        const existing = userMap.get(targetKey)
        const realDocId = !fDoc.docId.startsWith('user_') ? fDoc.docId : existing.docId
        userMap.set(targetKey, { ...existing, ...fDoc, docId: realDocId })
      } else {
        userMap.set(key, fDoc)
      }
    }

    // Filter out deleted accounts
    const list = Array.from(userMap.values()).filter((u) => u.status !== 'Deleted')

    list.sort((a, b) => {
      // Pinned: Administrators always stay at the top
      const aIsAdmin = a.role === 'Admin' || a.email === 'admin@relieftrack.com'
      const bIsAdmin = b.role === 'Admin' || b.email === 'admin@relieftrack.com'
      if (aIsAdmin && !bIsAdmin) return -1
      if (!aIsAdmin && bIsAdmin) return 1

      const getMillis = (obj) => {
        if (!obj) return Date.now()
        if (typeof obj.toMillis === 'function') return obj.toMillis()
        if (typeof obj.getTime === 'function') return obj.getTime()
        if (typeof obj === 'number') return obj
        const parsed = new Date(obj).getTime()
        return isNaN(parsed) ? Date.now() : parsed
      }

      const timeA = getMillis(a.createdAt)
      const timeB = getMillis(b.createdAt)
      if (timeA !== timeB) return timeB - timeA

      return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
    })

    onData(list)
  }

  const unsubDeleted = onSnapshot(collection(db, 'deletedUsers'), (delSnap) => {
    deletedEmails = new Set(delSnap.docs.map((d) => (d.data()?.email || d.id).toLowerCase().trim()))
    emitList()
  }, (err) => {
    console.warn('Error reading deletedUsers tracking:', err)
  })

  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    (snap) => {
      cachedSnap = snap
      emitList()
    },
    (err) => {
      console.error('Error in subscribeUsers:', err)
      const fallbackList = INITIAL_AUTH_USERS
        .filter((a) => !deletedEmails.has(a.email.toLowerCase().trim()))
        .map((a) => ({
          docId: `user_${a.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
          ...a,
        }))
      onData(fallbackList)
      onError?.(err)
    }
  )

  return () => {
    unsubDeleted()
    unsubUsers()
  }
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data()
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true })
}

export async function setUserStatus(uid, status, email = null) {
  const updatePayload = { status }
  if (status === 'On Hold') {
    updatePayload.isOnline = false
  }
  if (uid) {
    await setDoc(doc(db, 'users', uid), updatePayload, { merge: true })
  }
  const cleanEmail = (email || '').toLowerCase().trim()
  if (cleanEmail) {
    const placeholderId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`
    if (placeholderId !== uid) {
      await setDoc(doc(db, 'users', placeholderId), updatePayload, { merge: true }).catch(() => {})
    }
    try {
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail))
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        if (d.id !== uid) {
          await setDoc(doc(db, 'users', d.id), updatePayload, { merge: true })
        }
      }
    } catch (err) {
      console.warn('Error querying users by email during setUserStatus:', err)
    }
  }
}

export async function updateUserLocation(uid, location) {
  if (!uid) return
  await setDoc(doc(db, 'users', uid), {
    location: (location || '').trim(),
    lastLocationSync: serverTimestamp(),
  }, { merge: true })
}

export async function deleteUserProfile(uid, email = null) {
  const cleanEmail = (email || '').toLowerCase().trim()

  // 1. Request deletion from Firebase Authentication (via Cloud Function)
  try {
    const deleteFn = httpsCallable(functions, 'deleteUserAccount')
    await deleteFn({ uid, email: cleanEmail })
  } catch (fnErr) {
    console.warn('deleteUserAccount Cloud Function error (proceeding with Firestore cleanup):', fnErr?.message)
  }

  // 2. Add to deletedUsers tracking collection so seeded mock accounts never revive
  if (cleanEmail) {
    const delDocId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')
    try {
      await setDoc(doc(db, 'deletedUsers', delDocId), {
        email: cleanEmail,
        deletedAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('Error recording to deletedUsers:', err)
    }
  }

  // 3. Actually delete document(s) from Cloud Firestore users collection
  if (uid) {
    try {
      await deleteDoc(doc(db, 'users', uid))
    } catch (err) {
      console.warn('Error deleting user doc from Firestore by UID:', err)
    }
  }

  if (cleanEmail) {
    const placeholderId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`
    if (placeholderId !== uid) {
      try {
        await deleteDoc(doc(db, 'users', placeholderId))
      } catch (err) {}
    }
    try {
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail))
      const snap = await getDocs(q)
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'users', d.id)).catch(() => {})
      }
    } catch (err) {
      console.warn('Error querying users by email during deleteDoc:', err)
    }
  }
}

/**
 * Format elapsed time since a user was last active/went offline.
 * e.g., "Just went offline", "Offline for 15m", "Offline for 2h 10m", "Offline for 3d", "Never logged in"
 */
export function formatOfflineDuration(lastActiveAt) {
  if (!lastActiveAt) return 'Never logged in'
  const ms = lastActiveAt?.toMillis
    ? lastActiveAt.toMillis()
    : typeof lastActiveAt === 'number'
    ? lastActiveAt
    : new Date(lastActiveAt).getTime()

  if (!ms || isNaN(ms)) return 'Never logged in'

  const diffMs = Date.now() - ms
  if (diffMs < 0) return 'Just now'
  if (diffMs < 60 * 1000) return 'Just went offline'

  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 60) {
    return `Offline for ${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (hours < 24) {
    return `Offline for ${hours}h${remMinutes > 0 ? ` ${remMinutes}m` : ''}`
  }

  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (days < 7) {
    return `Offline for ${days}d${remHours > 0 ? ` ${remHours}h` : ''}`
  }

  if (days < 30) {
    return `Offline for ${days}d`
  }

  const months = Math.floor(days / 30)
  return `Offline for ${months}mo`
}





