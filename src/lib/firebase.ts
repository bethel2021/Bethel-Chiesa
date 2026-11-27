import { initializeApp } from 'firebase/app';
import appletConfig from '../../firebase-applet-config.json';

export const firebasePublicConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId,
};

export const firebaseApp = initializeApp({
  apiKey: firebasePublicConfig.apiKey,
  authDomain: firebasePublicConfig.authDomain,
  projectId: firebasePublicConfig.projectId,
  storageBucket: firebasePublicConfig.storageBucket,
  messagingSenderId: firebasePublicConfig.messagingSenderId,
  appId: firebasePublicConfig.appId,
});

let authSummary = {
  isSignedIn: false,
  emailVerified: false,
  isAnonymous: false,
  uid: null as string | null,
};

export function setAuthSummaryForErrors(next: {
  isSignedIn: boolean;
  emailVerified: boolean;
  isAnonymous: boolean;
  uid: string | null;
}): void {
  authSummary = next;
}

export function getCurrentAuthUid(): string | null {
  return authSummary.uid;
}
