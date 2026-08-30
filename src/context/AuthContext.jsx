import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../firebase.js'
import { handleRedirectResult } from '../firebase/auth'
import { ensureUserProfile, updateUserProfile } from '../firebase/users'
import { requestBrowserLocation, getBrowserLocation } from '../utils/getBrowserLocation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    requestBrowserLocation()

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return

      if (firebaseUser) {
        try {
          const redirectUser = await handleRedirectResult()
          if (redirectUser) {
            await ensureUserProfile(redirectUser)
            getBrowserLocation().then((loc) => {
              if (loc) updateUserProfile(redirectUser.uid, { location: loc }).catch(() => {})
            })
          }
        } catch {
          // ignore — no pending redirect or already processed
        }

        // Device login security: fingerprint + register device (new device -> email alert)
        try {
          const fpRaw = navigator.userAgent + '|' + window.screen.width + 'x' + window.screen.height + '|' + Intl.DateTimeFormat().resolvedOptions().timeZone
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fpRaw))
          const fingerprintHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
          const registerDevice = httpsCallable(functions, 'registerDevice')
          await registerDevice({ fingerprintHash, userAgent: navigator.userAgent })
        } catch {
          // Fallback: client-side tracking if functions not deployed (Blaze required)
          try {
            const { doc, getDocs, query, where, collection, setDoc, addDoc, serverTimestamp } = await import('firebase/firestore')
            const { db } = await import('../firebase.js')
            const fpRaw2 = navigator.userAgent + '|' + window.screen.width + 'x' + window.screen.height + '|' + Intl.DateTimeFormat().resolvedOptions().timeZone
            const hashBuffer2 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fpRaw2))
            const fingerprintHash2 = Array.from(new Uint8Array(hashBuffer2)).map((b) => b.toString(16).padStart(2, '0')).join('')
            const q = query(collection(db, `users/${firebaseUser.uid}/knownDevices`), where('fingerprintHash', '==', fingerprintHash2))
            const snap = await getDocs(q)
            if (snap.empty) {
              const deviceRef = doc(collection(db, `users/${firebaseUser.uid}/knownDevices`))
              await setDoc(deviceRef, {
                fingerprintHash: fingerprintHash2,
                userAgent: navigator.userAgent,
                firstSeen: serverTimestamp(),
                lastSeen: serverTimestamp(),
                isTrusted: false,
              })
              await addDoc(collection(db, `users/${firebaseUser.uid}/loginHistory`), {
                timestamp: serverTimestamp(),
                deviceId: deviceRef.id,
                isNewDevice: true,
                emailSent: false,
              })
              console.warn('New device detected - email alert requires Cloud Functions (Blaze plan + SendGrid key). Device logged to Firestore.')
            } else {
              const d = snap.docs[0]
              await setDoc(d.ref, { lastSeen: serverTimestamp() }, { merge: true })
              await addDoc(collection(db, `users/${firebaseUser.uid}/loginHistory`), {
                timestamp: serverTimestamp(),
                deviceId: d.id,
                isNewDevice: false,
                emailSent: false,
              })
            }
          } catch {}
        }
      }

      if (!cancelled) {
        setUser(firebaseUser)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
