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
          // non-blocking: if functions not deployed or offline, ignore
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
