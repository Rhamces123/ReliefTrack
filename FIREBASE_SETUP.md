# Firebase setup for ReliefTrack

Project: **relieftrack-fd1f3**

## Fix Google sign-in (`auth/configuration-not-found`)

This error means Google sign-in is not enabled in Firebase Console. The app code is correct; complete these steps:

### 1. Enable Authentication

1. Open [Firebase Console → Authentication](https://console.firebase.google.com/project/relieftrack-fd1f3/authentication)
2. If you see **Get started**, click it first (required to initialize Auth)

### 2. Enable Google sign-in

1. Go to **Sign-in method**
2. Click **Google** → **Enable**
3. Set a **Project support email**
4. Click **Save**

### 3. Enable Email/Password (optional)

On **Sign-in method**, enable **Email/Password** if you use email sign-up or sign-in.

### 4. Authorized domains

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Ensure **localhost** is listed (for local dev with `npm run dev`)
3. `relieftrack-fd1f3.firebaseapp.com` is added automatically

### 5. Firestore (user profiles)

1. Create a Firestore database if you have not already
2. Use these rules under **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /reliefRequests/{requestId} {
      allow read, create, update, delete: if request.auth != null;
    }
    match /inventoryItems/{itemId} {
      allow read, create, update, delete: if request.auth != null;
    }
  }
}
```

### 6. If Google still fails

- [Google Cloud OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) — set app name and support email (Testing mode is fine for dev)
- Hard-refresh the app (`Ctrl+Shift+R`) or try an incognito window
- Confirm [`src/firebase.js`](src/firebase.js) `projectId` matches your Firebase project

## Google Maps (location autocomplete)

For Philippine place suggestions on the Requests form, see [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md).

## Verify

1. `npm run dev`
2. Open `/login` or `/signup`
3. Click **Continue with Google** — the Google account picker should open
4. After sign-in, you should land on `/home`
