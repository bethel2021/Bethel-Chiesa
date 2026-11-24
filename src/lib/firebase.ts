import { initializeApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId;

export const firebaseApp = initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  try {
    return initializeFirestore(
      firebaseApp,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firestoreDatabaseId
    );
  } catch {
    return getFirestore(firebaseApp, firestoreDatabaseId);
  }
}

export const db = createFirestoreClient();

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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    isSignedIn: boolean;
    emailVerified: boolean;
    isAnonymous: boolean;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      isSignedIn: authSummary.isSignedIn,
      emailVerified: authSummary.emailVerified,
      isAnonymous: authSummary.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function fetchPublicBundleFromServer() {
  const bundleRef = doc(db, 'church_sections', 'public_bundle');
  try {
    return await getDocFromServer(bundleRef);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    const msg = error instanceof Error ? error.message : String(error ?? '');
    if (code === 'unavailable' || msg.includes('the client is offline')) {
      return await getDoc(bundleRef);
    }
    throw error;
  }
}
