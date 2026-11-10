/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Console -> Project Settings -> General -> Your apps -> Web app dan olinadigan konfiguratsiya
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForDevelopment12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eduexam-secure.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eduexam-secure",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eduexam-secure.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

// Singleton pattern: Faqat bitta Firebase App instansiyasi yaratiladi
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Authentication instansiyasi
export const auth = getAuth(app);

// Cloud Firestore Database instansiyasi
export const db = getFirestore(app);
