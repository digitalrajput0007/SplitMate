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
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { auth, WEB_CLIENT_ID } from '../config/firebase';

// Configure Google Sign-In with Web Client ID
try {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
  });
} catch (e) {
  console.log('GoogleSignin configure exception:', e);
}

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
    await updateProfile(auth.currentUser, {
      displayName: displayName,
      photoURL: photoURL || auth.currentUser.photoURL || undefined
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
    // Native Mobile Google Sign-In
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    
    // Extract user profile & idToken across v12 and v13 SDK variations
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

    // Sync displayName and photoURL to Firebase Auth user profile if missing
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

import { resetActiveUserCurrency } from './currencyService';

export const signOutUser = async (): Promise<void> => {
  resetActiveUserCurrency();
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
