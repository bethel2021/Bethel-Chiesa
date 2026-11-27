import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../data/cacheConfig';
import { firebaseApp, setAuthSummaryForErrors } from './firebase';

export type AuthUserSummary = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
};

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  await auth.authStateReady();
  const current = auth.currentUser;
  if (!current) return null;
  return await current.getIdToken(forceRefresh);
}

export function subscribeAdminAuthAndRbac(
  onUpdate: (state: {
    user: User | null;
    isAdmin: boolean;
    isMainAdmin: boolean;
    canViewVisitorStats: boolean;
    authReady: boolean;
  }) => void
): () => void {
  let authEpoch = 0;

  const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
    authEpoch += 1;
    const currentEpoch = authEpoch;

    setAuthSummaryForErrors({
      isSignedIn: Boolean(currentUser),
      emailVerified: Boolean(currentUser?.emailVerified),
      isAnonymous: Boolean(currentUser?.isAnonymous),
      uid: currentUser?.uid ?? null,
    });

    if (!currentUser || !currentUser.emailVerified) {
      onUpdate({
        user: currentUser,
        isAdmin: false,
        isMainAdmin: false,
        canViewVisitorStats: false,
        authReady: true,
      });
      return;
    }

    const isBootstrapped =
      currentUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    if (isBootstrapped) {
      onUpdate({
        user: currentUser,
        isAdmin: true,
        isMainAdmin: true,
        canViewVisitorStats: true,
        authReady: true,
      });
      return;
    }

    onUpdate({
      user: currentUser,
      isAdmin: false,
      isMainAdmin: false,
      canViewVisitorStats: false,
      authReady: false,
    });

    void currentUser
      .getIdToken()
      .then(async (token) => {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as {
          isAdmin?: boolean;
          isMainAdmin?: boolean;
          canViewVisitorStats?: boolean;
        };
      })
      .then((role) => {
        if (currentEpoch !== authEpoch) return;
        onUpdate({
          user: currentUser,
          isAdmin: Boolean(role.isAdmin),
          isMainAdmin: Boolean(role.isMainAdmin),
          canViewVisitorStats: Boolean(role.canViewVisitorStats),
          authReady: true,
        });
      })
      .catch(() => {
        if (currentEpoch !== authEpoch) return;
        onUpdate({
          user: currentUser,
          isAdmin: false,
          isMainAdmin: false,
          canViewVisitorStats: false,
          authReady: true,
        });
      });
  });

  return () => {
    authEpoch += 1;
    unsubAuth();
  };
}
