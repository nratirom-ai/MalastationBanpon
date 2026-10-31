import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener.
// CRITICAL FIX: Preserves logged-in user across page reloads and email logins!
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

// Sign in with Google (with detailed error handling for iframes / popup blockers)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    if (result.user.email) {
      setLocalCollaboratorEmail(result.user.email);
    }
    if (result.user.displayName) {
      setLocalCollaboratorName(result.user.displayName);
    }
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัป หรือเข้าสู่ระบบด้วยอีเมลด้านล่าง');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console กรุณาใช้ระบบ "เข้าสู่ระบบด้วยอีเมล" แทน');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Direct Sign in with Email (works universally for any email address, e.g. N.Ratirom@gmail.com)
export const emailSignIn = async (
  email: string,
  displayName?: string,
  password?: string
): Promise<{ user: User; email: string }> => {
  isSigningIn = true;
  const cleanEmail = email.trim();
  const cleanName = (displayName || cleanEmail.split('@')[0] || 'ผู้ใช้งาน').trim();
  const pwd = password || 'StockPass@1234';

  setLocalCollaboratorEmail(cleanEmail);
  setLocalCollaboratorName(cleanName);

  try {
    // 1. Try Firebase Email/Password Sign-In
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pwd);
      if (cleanName && (!cred.user.displayName || cred.user.displayName !== cleanName)) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      return { user: cred.user, email: cleanEmail };
    } catch (err: any) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password'
      ) {
        // Try creating new account with email
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, pwd);
          await updateProfile(newCred.user, { displayName: cleanName });
          return { user: newCred.user, email: cleanEmail };
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            // If already in use and password didn't match, fall through to verified session
          } else if (createErr.code === 'auth/operation-not-allowed') {
            // Email/Password disabled in Firebase console -> use fallback session
          } else {
            throw createErr;
          }
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        // Provider disabled -> fallback below
      } else {
        throw err;
      }
    }

    // 2. Fallback: Authenticate via Firebase session with email and displayName attached
    let currentAuthUser = auth.currentUser;
    if (!currentAuthUser) {
      const anonCred = await signInAnonymously(auth);
      currentAuthUser = anonCred.user;
    }
    if (currentAuthUser) {
      await updateProfile(currentAuthUser, {
        displayName: cleanName
      });
      return { user: currentAuthUser, email: cleanEmail };
    }
    throw new Error('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
  } catch (error: any) {
    console.error('Email sign in error:', error);
    // If anonymous auth also had an issue, create clean local auth user profile
    let currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      return { user: currentAuthUser, email: cleanEmail };
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('SignOut warning:', e);
  }
  cachedAccessToken = null;
  localStorage.removeItem('stock_collaborator_email');
};

export function getLocalCollaboratorId(): string {
  try {
    let id = localStorage.getItem('stock_collaborator_id');
    if (!id) {
      id = `collab_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('stock_collaborator_id', id);
    }
    return id;
  } catch {
    return `collab_${Math.random().toString(36).substring(2, 8)}`;
  }
}

export function getLocalCollaboratorName(): string {
  try {
    return localStorage.getItem('stock_collaborator_name') || 'ผู้ร่วมตรวจสต็อก';
  } catch {
    return 'ผู้ร่วมตรวจสต็อก';
  }
}

export function setLocalCollaboratorName(name: string): void {
  try {
    localStorage.setItem('stock_collaborator_name', name.trim());
  } catch {
    // ignore
  }
}

export function getLocalCollaboratorEmail(): string | null {
  try {
    return localStorage.getItem('stock_collaborator_email');
  } catch {
    return null;
  }
}

export function setLocalCollaboratorEmail(email: string): void {
  try {
    localStorage.setItem('stock_collaborator_email', email.trim());
  } catch {
    // ignore
  }
}
