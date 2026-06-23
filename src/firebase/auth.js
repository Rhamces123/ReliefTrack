import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase.js'

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

export function signInWithGoogle() {
  return signInWithRedirect(auth, googleProvider)
}

export async function handleRedirectResult() {
  const result = await getRedirectResult(auth)
  return result?.user || null
}

export async function signOutUser() {
  await signOut(auth)
}
