import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { updateDoc, serverTimestamp } from 'firebase/firestore'
import { getDeviceDocRef } from '../firebase/devices'

export default function DeviceActionPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState('processing') // 'processing' | 'approve' | 'reject' | 'invalid'
  const processedRef = useRef(false)

  const uid = params.get('uid')
  const deviceId = params.get('deviceId')
  const token = params.get('token')
  const action = params.get('action')
  const looksValid = !!(
    uid && deviceId && token && (action === 'approve' || action === 'reject')
  )

  useEffect(() => {
    if (!looksValid) return
    if (processedRef.current) return
    processedRef.current = true

    const data =
      action === 'approve'
        ? {
            isTrusted: true,
            rejected: false,
            approvalToken: token,
            processedAt: serverTimestamp(),
          }
        : {
            isTrusted: false,
            rejected: true,
            approvalToken: token,
            processedAt: serverTimestamp(),
          }

    updateDoc(getDeviceDocRef(uid, deviceId), data)
      .then(() => setState(action))
      .catch(() => setState('invalid'))
  }, [params, uid, deviceId, token, action, looksValid])

  return (
    <div className="ndv-backdrop">
      <div className="ndv-card">
        {!looksValid || state === 'invalid' ? (
          <>
            <div className="ndv-icon">⚠️</div>
            <h3 className="ndv-title">Link invalid or expired</h3>
            <p className="ndv-text">
              This approval link is no longer valid. Request a new approval email from the device
              that is trying to sign in.
            </p>
          </>
        ) : state === 'processing' ? (
          <>
            <div className="ndv-icon">⏳</div>
            <h3 className="ndv-title">Processing your request…</h3>
            <p className="ndv-text">Applying your choice to the new device login.</p>
            <div className="ndv-spinner" />
          </>
        ) : state === 'approve' ? (
          <>
            <div className="ndv-icon">✅</div>
            <h3 className="ndv-title">Device approved</h3>
            <p className="ndv-text">
              This new device can now sign in to your ReliefTrack account. Go back to that device
              and it will let you in.
            </p>
          </>
        ) : (
          <>
            <div className="ndv-icon">🛡️</div>
            <h3 className="ndv-title">Login rejected</h3>
            <p className="ndv-text">
              The new device cannot sign in. Consider changing your ReliefTrack password if you
              didn&apos;t recognize this login.
            </p>
          </>
        )}
      </div>
    </div>
  )
}