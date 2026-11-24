import { initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firestoreDatabaseId);
  }
}

export const db = createFirestoreClient();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Prevent orphaned Firebase Auth AbstractPopupRedirectOperation.onAuthEvent races
// from emitting unhandled rejections after a popup has already settled/cancelled.
if (typeof window !== 'undefined') {
  const globalKey = '__bethelAuthAssertionGuardInstalled';
  const win = window as Window & { [globalKey]?: boolean };
  if (!win[globalKey]) {
    win[globalKey] = true;
    window.addEventListener('unhandledrejection', (event) => {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === 'string'
            ? event.reason
            : '';
      if (
        msg.includes('INTERNAL ASSERTION FAILED') &&
        msg.includes('Pending promise was never set')
      ) {
        event.preventDefault();
      }
    });
  }
}

let activeGoogleSignIn: Promise<void> | null = null;

export async function signInWithGoogleSafe(): Promise<void> {
  if (activeGoogleSignIn) {
    return activeGoogleSignIn;
  }

  activeGoogleSignIn = (async () => {
    await auth.authStateReady();
    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? '');
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (
        msg.includes('Pending promise was never set') ||
        code === 'auth/cancelled-popup-request'
      ) {
        await auth.authStateReady();
        if (auth.currentUser) {
          return;
        }
        const friendly = new Error('登录弹窗请求已中断，请重新点击登录。') as Error & {
          code?: string;
        };
        friendly.code = code || 'auth/popup-interrupted';
        throw friendly;
      }
      throw error;
    }
  })().finally(() => {
    activeGoogleSignIn = null;
  });

  return activeGoogleSignIn;
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
      isSignedIn: Boolean(auth.currentUser),
      emailVerified: Boolean(auth.currentUser?.emailVerified),
      isAnonymous: Boolean(auth.currentUser?.isAnonymous),
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
