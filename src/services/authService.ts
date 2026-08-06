import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut, 
  updateProfile,
  User,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth, WEB_CLIENT_ID, db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

let GoogleSignin: any = null;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  if (GoogleSignin?.configure) {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }
} catch (e) {
  console.log('Native GoogleSignin module not available in this environment:', e);
}

export const sendOTPEmail = async (email: string): Promise<string> => {
  const normalizedEmail = email.trim().toLowerCase();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const otpRef = doc(db, 'otpCodes', normalizedEmail);
  await setDoc(otpRef, {
    email: normalizedEmail,
    otpCode,
    expiresAt,
    createdAt: serverTimestamp(),
  });

  console.log(`[OTP Verification] Sent 6-digit OTP code to ${normalizedEmail}: ${otpCode}`);
  return otpCode;
};

export const verifyOTP = async (email: string, enteredCode: string): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();
  const otpRef = doc(db, 'otpCodes', normalizedEmail);
  const snap = await getDoc(otpRef);

  if (!snap.exists()) {
    throw new Error('No OTP code requested for this email or it has expired.');
  }

  const data = snap.data();
  const now = Date.now();

  if (now > data.expiresAt) {
    await deleteDoc(otpRef);
    throw new Error('OTP code has expired. Please request a new code.');
  }

  if (data.otpCode !== enteredCode.trim()) {
    throw new Error('Invalid OTP code. Please check your email and try again.');
  }

  await deleteDoc(otpRef);
  return true;
};

export const signUpWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
  }
  return userCredential.user;
};

export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
};

export const resetPassword = async (email: string): Promise<void> => {
  await firebaseSendPasswordResetEmail(auth, email);
};

export const resendVerificationEmail = async (): Promise<void> => {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  } else {
    throw new Error('No user is currently signed in.');
  }
};

export const checkEmailVerified = async (): Promise<boolean> => {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
  }
  return false;
};

export const updateUserProfile = async (displayName: string, photoURL?: string): Promise<void> => {
  if (auth.currentUser) {
    // If photoURL is explicitly an empty string, we set it to null in Firebase Auth
    // to remove the previous photo.
    const newPhotoURL = (photoURL === '' || photoURL === null) ? null : (photoURL || auth.currentUser.photoURL || null);

    await updateProfile(auth.currentUser, {
      displayName: displayName,
      photoURL: newPhotoURL
    });
  }
};

export interface GoogleAuthResult {
  user: User;
  googleName?: string;
  googlePhoto?: string;
}

export const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return {
      user: result.user,
      googleName: result.user.displayName || undefined,
      googlePhoto: result.user.photoURL || undefined
    };
  } else {
    if (!GoogleSignin) {
      throw new Error('Google Sign-In native module is not available in Expo Go. Please test on a standalone development build or web.');
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    
    const dataObj = (signInResult as any).data || signInResult;
    const idToken = dataObj?.idToken;
    const gUser = dataObj?.user;

    const googleName = gUser?.name || (gUser?.givenName ? `${gUser.givenName} ${gUser.familyName || ''}`.trim() : undefined);
    const googlePhoto = gUser?.photo || undefined;

    if (!idToken) {
      throw new Error('No Google ID Token returned');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);

    if (userCredential.user && (!userCredential.user.displayName || !userCredential.user.photoURL)) {
      try {
        await updateProfile(userCredential.user, {
          displayName: userCredential.user.displayName || googleName || undefined,
          photoURL: userCredential.user.photoURL || googlePhoto || undefined
        });
      } catch (e) {
        console.log('Error syncing Google profile to Firebase user:', e);
      }
    }

    return {
      user: userCredential.user,
      googleName: userCredential.user.displayName || googleName || undefined,
      googlePhoto: userCredential.user.photoURL || googlePhoto || undefined
    };
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      await GoogleSignin.signOut();
    }
  } catch (e) {
    // Ignore if not signed in via Google
  }
  await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
