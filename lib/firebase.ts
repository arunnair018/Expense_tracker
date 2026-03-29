import { initializeApp, getApps, getApp } from 'firebase/app'
import { initializeAuth, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Config validation ────────────────────────────────────────────────────────
// Fail loudly in development if env vars are missing, so the error is obvious.
const required = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
]
const missing = required.filter(k => !process.env[k])
if (missing.length > 0 && __DEV__) {
  console.error(
    `[Firebase] Missing environment variables:\n  ${missing.join('\n  ')}\n` +
    `Copy .env.example → .env and fill in your Firebase project values.\n` +
    `You can find them at: https://console.firebase.google.com → Project Settings → Your apps`
  )
}

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// ─── Auth ─────────────────────────────────────────────────────────────────────
// getReactNativePersistence was removed from the public firebase/auth API in
// firebase v12. Access it via require() with a runtime existence check so this
// works on both older and newer SDK versions without crashing.
function createAuth() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth')
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      })
    }
    return initializeAuth(app)
  } catch {
    // Auth already initialised on hot-reload — return existing instance.
    return getAuth(app)
  }
}

export const auth = createAuth()

// ─── Firestore ────────────────────────────────────────────────────────────────
export const db = getFirestore(app)
