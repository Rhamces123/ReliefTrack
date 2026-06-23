/**
 * User-friendly Firebase Auth error messages.
 * Returns null when no message should be shown (e.g. user cancelled popup).
 */
export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error?.code) {
    return error?.message || fallback
  }

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return null
    case 'auth/configuration-not-found':
      return (
        'Google sign-in is not enabled in Firebase. Open Firebase Console → Authentication → Sign-in method, enable Google, set a support email, and save.'
      )
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Enable it under Firebase Console → Authentication → Sign-in method.'
    case 'auth/unauthorized-domain':
      return 'This site is not authorized. Add your domain (e.g. localhost) under Firebase Console → Authentication → Settings → Authorized domains.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    default:
      return error.message || fallback
  }
}
