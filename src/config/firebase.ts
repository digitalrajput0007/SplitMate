import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  Auth,
  // @ts-ignore
  getReactNativePersistence 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  memoryLocalCache, 
  getFirestore 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyB2fCMYGgRHXYOiiESoQeqg9F_BIS2pS60",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "splitmate-d2d66.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "splitmate-d2d66",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "splitmate-d2d66.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "563027170263",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:563027170263:android:4b72f0d1051e81d406f192"
};

export const WEB_CLIENT_ID = "563027170263-279jvhh5r7vsvab35satlq4ill6gfdkr.apps.googleusercontent.com";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with React Native AsyncStorage Persistence
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

// Initialize Firestore Database
let db: any;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch (e) {
  db = getFirestore(app);
}

export { app, auth, db };
