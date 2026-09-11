import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signUpWithEmail(email, password, displayName) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(user, { displayName })
  }
  return user
}

export async function signInWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function handleRedirectResult() {
  const result = await getRedirectResult(auth)
  return result?.user || null
}

export async function signOutUser() {
  const currentUid = auth.currentUser?.uid
  if (currentUid) {
    try {
      await setDoc(doc(db, 'users', currentUid), {
        isOnline: false,
        lastActiveAt: serverTimestamp(),
      }, { merge: true })
    } catch {
      // non-fatal
    }
  }
  await signOut(auth)
}

