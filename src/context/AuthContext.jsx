import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'
import { handleRedirectResult, signOutUser, sendPasswordReset } from '../firebase/auth'
import { ensureUserProfile } from '../firebase/users'
import { getBrowserName, getOsName, markDeviceTrusted, evaluateDevice } from '../firebase/devices'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deviceStatus, setDeviceStatus] = useState(null) // 'trusted' | 'new' | 'pending'
  const [deviceId, setDeviceId] = useState(null)
  const [deviceChecked, setDeviceChecked] = useState(false)
  const [deviceBlocked, setDeviceBlocked] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const checkedRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return

      if (firebaseUser) {
        let redirectUser = null
        try {
          redirectUser = await handleRedirectResult()
          if (redirectUser) {
            await ensureUserProfile(redirectUser)
          }
        } catch {
          // ignore — no pending redirect or profile errors
        }

        try {
          if (!redirectUser) await ensureUserProfile(firebaseUser)
        } catch {
          // ignore — profile creation errors are non-fatal
        }

        // Device verification: run once per auth session
        if (checkedRef.current !== firebaseUser.uid) {
          checkedRef.current = firebaseUser.uid
          try {
            const result = await evaluateDevice(firebaseUser.uid)
            setDeviceId(result.deviceId)
            setDeviceStatus(result.status)
            setDeviceChecked(true)
            setDeviceBlocked(result.status === 'new' || result.status === 'pending')
            setDeviceInfo({
              browser: getBrowserName(),
              operatingSystem: getOsName(),
              deviceName: `${getBrowserName()} • ${getOsName()}`,
            })
          } catch (err) {
            console.error('Device verification error:', err)
            setDeviceStatus('trusted')
            setDeviceChecked(true)
            setDeviceBlocked(false)
          }
        }
      }

      if (!cancelled) {
        if (!firebaseUser) {
          checkedRef.current = null
          setDeviceStatus(null)
          setDeviceId(null)
          setDeviceChecked(false)
          setDeviceBlocked(false)
          setDeviceInfo(null)
        }
        setUser(firebaseUser)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const handleDeviceTrusted = useCallback(async () => {
    if (user && deviceId) {
      await markDeviceTrusted(user.uid, deviceId).catch(() => {})
    }
    setDeviceBlocked(false)
    setDeviceStatus('trusted')
  }, [user, deviceId])

  const handleDeviceRejected = useCallback(async (secureAccount = false) => {
    if (secureAccount && user?.email) {
      try {
        await sendPasswordReset(user.email)
      } catch {
        // ignore — password reset email failures are non-fatal
      }
    }
    await signOutUser().catch(() => {})
    setDeviceBlocked(false)
    setDeviceStatus(null)
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        deviceStatus,
        deviceId,
        deviceChecked,
        deviceBlocked,
        deviceInfo,
        handleDeviceTrusted,
        handleDeviceRejected,
      }}
    >
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