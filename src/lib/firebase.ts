import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const ADMIN_EMAILS = [
  'lord79915@gmail.com',
  'pythoxfashion@gmail.com',
] as const;
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = (firebaseConfig.projectId || '').trim();
export const STORAGE_BUCKET = (firebaseConfig.storageBucket || '').trim();
export const storage = STORAGE_BUCKET
  ? getStorage(app, `gs://${STORAGE_BUCKET.replace(/^gs:\/\//i, '')}`)
  : getStorage(app);

export function getStorageInstance(bucketName?: string) {
  const cleanBucket = (bucketName || STORAGE_BUCKET || '').trim().replace(/^gs:\/\//i, '');
  return cleanBucket ? getStorage(app, `gs://${cleanBucket}`) : storage;
}

export function getFirebaseStorageConfigInfo() {
  return {
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    configured: Boolean(STORAGE_BUCKET),
  };
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export function isVerifiedAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified) return false;
  const email = (user.email || '').toLowerCase();
  return ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === email);
}

export async function signInAdminWithGoogle(): Promise<User> {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    if (!isVerifiedAdminUser(credential.user)) {
      await signOut(auth);
      throw new Error(
        'Access denied. This Google account is not authorized for administrator access.'
      );
    }
    return credential.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/unauthorized-domain') {
      const host =
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'this domain';
      throw new Error(
        `Unauthorized domain (${host}). Add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups and try again.');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in window was closed before completing authentication.');
    }
    throw err instanceof Error ? err : new Error('Unable to sign in with Google.');
  }
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function cleanFirestorePayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestorePayload(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = cleanFirestorePayload(v);
      }
    });
    return out as T;
  }
  return value;
}
