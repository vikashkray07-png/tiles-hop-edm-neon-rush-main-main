import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

console.log('[Firebase Diag] Initializing Firebase app with project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

let cachedAuthError: { code?: string; message: string } | null = null;

// Resolves once Firebase Auth state is settled (returns authenticated user or null on error)
// Uses persistent IndexedDB session first; only signs in anonymously if no existing session exists.
export const authReady = new Promise<User | null>((resolve) => {
  let settled = false;

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {
      if (settled) return;

      if (user) {
        // User session restored from persistence (e.g. IndexedDB)
        settled = true;
        cachedAuthError = null;
        console.log('[Firebase Diag] Auth ready (restored session). Canonical UID:', user.uid);
        unsubscribe();
        resolve(user);
      } else {
        // No existing session found in persistence; perform anonymous sign-in once
        try {
          const cred = await signInAnonymously(auth);
          if (!settled) {
            settled = true;
            cachedAuthError = null;
            console.log('[Firebase Diag] Anonymous sign-in created new UID:', cred.user.uid);
            unsubscribe();
            resolve(cred.user);
          }
        } catch (err: any) {
          if (!settled) {
            settled = true;
            const code = err?.code || 'auth/unknown';
            const msg = err?.message || String(err);
            cachedAuthError = { code, message: msg };
            console.warn('[Firebase Diag] Anonymous sign-in warning:', code, msg);

            if (code === 'auth/admin-restricted-operation' || msg.includes('admin-restricted-operation')) {
              console.error(
                `\n[ACTION REQUIRED] Anonymous Authentication is disabled in your Firebase console for project ${firebaseConfig.projectId}.\n` +
                `Please enable Anonymous sign-in under Authentication > Sign-in method in the Firebase Console:\n` +
                `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers\n`
              );
            }
            unsubscribe();
            resolve(null);
          }
        }
      }
    },
    (err) => {
      if (!settled) {
        settled = true;
        const code = (err as any)?.code || 'auth/unknown';
        const msg = (err as any)?.message || String(err);
        cachedAuthError = { code, message: msg };
        unsubscribe();
        resolve(null);
      }
    }
  );
});

export function getAuthError(): { code?: string; message: string } | null {
  return cachedAuthError;
}

export function getCanonicalPlayerId(): string | null {
  return auth.currentUser ? auth.currentUser.uid : null;
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Background test connection
async function testConnection() {
  try {
    const user = await authReady;
    if (user) {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log('[Firebase Diag] Firestore connection test passed.');
    }
  } catch (error) {
    console.warn('[Firebase Diag] Firestore test notice:', error);
  }
}
testConnection();
