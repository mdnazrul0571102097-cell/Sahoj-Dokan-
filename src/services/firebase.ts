import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  enableIndexedDbPersistence,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDm65Jv9TXqf0EkXJho2u6CikOLQKUljYc",
  authDomain: "sahoj-dokan-pos.firebaseapp.com",
  projectId: "sahoj-dokan-pos",
  storageBucket: "sahoj-dokan-pos.firebasestorage.app",
  messagingSenderId: "852004899132",
  appId: "1:852004899132:web:549124ff83399bf45b7639",
  measurementId: "G-71Y4D98KGY"
};

// Initialize or reuse Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
export const firestore = getFirestore(app);

// Enable Firestore offline persistence if supported in browser/webview
try {
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(firestore).catch((err) => {
      console.warn('Firestore offline persistence warning:', err.code);
    });
  }
} catch (e) {
  console.warn('Firestore persistence init:', e);
}

export function convertBengaliToEnglishDigits(str: string): string {
  if (!str) return '';
  const bnMap: { [key: string]: string } = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(str).replace(/[০-৯]/g, (d) => bnMap[d] || d);
}

export function cleanPhoneNumber(phone: string): string {
  const converted = convertBengaliToEnglishDigits(String(phone || ''));
  const digits = converted.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

