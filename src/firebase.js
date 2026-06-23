import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAJsrz79MRt5jziHV59VwohtX7sM8cnQaI',
  authDomain: 'relieftrack-fd1f3.firebaseapp.com',
  databaseURL: 'https://relieftrack-fd1f3-default-rtdb.firebaseio.com',
  projectId: 'relieftrack-fd1f3',
  storageBucket: 'relieftrack-fd1f3.firebasestorage.app',
  messagingSenderId: '312004285973',
  appId: '1:312004285973:web:da7cdf3caf312bb503e01c',
  measurementId: 'G-QR1FSNFPWV',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const db = getFirestore(app)

let analytics = null
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app)
  }
})
export { analytics }
