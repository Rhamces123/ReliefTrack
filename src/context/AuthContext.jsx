import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'
import { handleRedirectResult, signOutUser, sendPasswordReset } from '../firebase/auth'
import { ensureUserProfile } from '../firebase/users'
import { getBrowserName, getOsName, evaluateDevice, sendDeviceApprovalEmail } from '../firebase/devices'
import { getBrowserLocation } from '../utils/getBrowserLocation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deviceStatus, setDeviceStatus] = useState(null) // 'trusted' | 'pending'
  const [deviceId, setDeviceId] = useState(null)
  const [deviceChecked, setDeviceChecked] = useState(false)
  const [deviceBlocked, setDeviceBlocked] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [emailState, setEmailState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const checkedRef = useRef(null)
  const approvalTokenRef = useRef(null)
  const emailSentRef = useRef(null)

  const getDeviceInfo = useCallback(() => ({
    browser: getBrowserName(),
    operatingSystem: getOsName(),
    deviceName: `${getBrowserName()} • ${getOsName()}`,
  }), [])

  const doSendApprovalEmail = useCallback(async (fbUser, devId, token, location) => {
    setEmailState('sending')
    const origin = window.location.origin
    const approveUrl = `${origin}/device-action?${new URLSearchParams({
      uid: fbUser.uid,
      deviceId: devId,
      token,
      action: 'approve',
    })}`
    const rejectUrl = `${origin}/device-action?${new URLSearchParams({
      uid: fbUser.uid,
      deviceId: devId,
      token,
      action: 'reject',
    })}`
    try {
      await sendDeviceApprovalEmail({
        recipient: fbUser.email,
        displayName: fbUser.displayName || 'there',
        deviceLabel: `${getBrowserName()} • ${getOsName()}`,
        location: location || '',
        timeLabel: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
        approveUrl,
        rejectUrl,
      })
      setEmailState('sent')
    } catch (err) {
      console.error('Approval email send failed:', err)
      setEmailState('error')
    }
  }, [])

  const sendApprovalEmailForCurrent = useCallback(async (fbUser, devId, token) => {
    let location
    try {
      location = (await getBrowserLocation()) || ''
    } catch {
      location = ''
    }
    await doSendApprovalEmail(fbUser, devId, token, location)
  }, [doSendApprovalEmail])

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
            approvalTokenRef.current = result.approvalToken || null
            setDeviceId(result.deviceId)
            setDeviceStatus(result.status)
            setDeviceChecked(true)
            setDeviceBlocked(result.status === 'pending')
            setDeviceInfo(getDeviceInfo())

            if (result.status === 'pending' && result.approvalToken) {
              const key = `${firebaseUser.uid}:${result.deviceId}`
              if (emailSentRef.current !== key) {
                emailSentRef.current = key
                await sendApprovalEmailForCurrent(firebaseUser, result.deviceId, result.approvalToken)
              }
            }
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
          emailSentRef.current = null
          approvalTokenRef.current = null
          setDeviceStatus(null)
          setDeviceId(null)
          setDeviceChecked(false)
          setDeviceBlocked(false)
          setDeviceInfo(null)
          setEmailState('idle')
        }
        setUser(firebaseUser)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [getDeviceInfo, sendApprovalEmailForCurrent])

  // Approval was granted from the email link on the /device-action page.
  // The isTrusted flag is already on Firestore, so we only unlock locally.
  const handleDeviceTrusted = useCallback(() => {
    setDeviceBlocked(false)
    setDeviceStatus('trusted')
  }, [])

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

  const resendApprovalEmail = useCallback(async () => {
    if (!user || !deviceId || !approvalTokenRef.current) return
    await sendApprovalEmailForCurrent(user, deviceId, approvalTokenRef.current)
  }, [user, deviceId, sendApprovalEmailForCurrent])

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
        emailState,
        handleDeviceTrusted,
        handleDeviceRejected,
        resendApprovalEmail,
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