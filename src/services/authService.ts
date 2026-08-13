import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
  GoogleAuthProvider,
  signInWithCredential,
  deleteUser,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app, WEB_CLIENT_ID } from "../config/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { NotificationService } from "./NotificationService";
import { deletePinHash } from "./secureStorageService";
import { cleanupUserFromFirestore } from "./firestoreService";
import { setSentryUserContext, clearSentryUserContext, captureError } from "../config/sentry";
import { TelemetryService } from "./telemetryService";

// Initialize Google Signin exactly once
if (Platform.OS !== 'web') {
  console.log("[Auth] Configuring Google Sign-in with ID:", WEB_CLIENT_ID);
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
}

const functions = getFunctions(app, 'us-central1');

/* =========================================================
   🌐 GOOGLE SIGN IN
========================================================= */
export const signInWithGoogle = async () => {
  try {
    if (Platform.OS === 'web') {
      throw new Error("Google Sign-in not implemented for web yet");
    }

    console.log("[Auth] Starting Google Sign-in flow...");

    // 1. Check Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 2. Clear any existing session to force account picker
    try {
      await GoogleSignin.signOut();
    } catch (e) { }

    // 3. Start Google Sign-in flow
    const userInfo = await GoogleSignin.signIn();
    console.log("[Auth] Google Sign-in response received");

    // 4. Get credential for Firebase
    const idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;

    let finalIdToken = idToken;
    if (!finalIdToken) {
      console.warn("[Auth] No ID Token found in response, trying getTokens()...");
      const tokens = await GoogleSignin.getTokens();
      finalIdToken = tokens.idToken;
    }

    if (!finalIdToken) throw new Error("Could not retrieve ID Token from Google");

    console.log("[Auth] Firebase Sign-in with credential...");
    const credential = GoogleAuthProvider.credential(finalIdToken);

    // 5. Sign in to Firebase
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    setSentryUserContext({ uid: user.uid, email: user.email, displayName: user.displayName });
    TelemetryService.trackLogin('google');

    const data = (userInfo as any).data || userInfo;
    return {
      user,
      googleName: data.user?.name,
      googlePhoto: data.user?.photo,
    };
  } catch (error: any) {
    if (error.code === '7') {
      console.error("[Auth] Google Sign-in Network Error. Check internet connection.");
    } else if (error.code === '10') {
      console.error("[Auth] DEVELOPER_ERROR: This usually means SHA-1 mismatch or wrong Web Client ID.");
    }
    console.error("[Auth] Google Sign-in Error Details:", JSON.stringify(error, null, 2));
    captureError(error, { tags: { location: 'authService', action: 'signInWithGoogle' } });
    throw error;
  }
};




/* =========================================================
   📧 SEND OTP (HTTP)
========================================================= */
export const sendOTPEmailHTTP = async (email: string, mode: 'signup' | 'reset' | 'none' = 'none') => {
  const trimmedEmail = email.trim().toLowerCase();
  console.log(`[HTTP] Calling sendOTPEmailTest for: ${trimmedEmail}, mode: ${mode}`);
  const url = 'https://us-central1-splitmate-d2d66.cloudfunctions.net/sendOTPEmailTest';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: trimmedEmail, mode }),
    });

    const responseText = await response.text();
    console.log('[HTTP] response raw:', responseText.slice(0, 150));

    if (!response.ok) {
      if (response.status === 500 || response.status === 503 || responseText.includes('<html')) {
        throw new Error('OTP service is temporarily unavailable.');
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        if (responseText && responseText.length < 200) {
          let plain = responseText.trim();
          if (plain.toLowerCase().includes('rate') || plain.toLowerCase().includes('exceeded') || plain.toLowerCase().includes('too many')) {
            throw new Error('Too many requests / Rate limit exceeded. Please try after some time.');
          }
          throw new Error(plain);
        }
        throw new Error('Server returned an invalid response format.');
      }

      let errMsg = result?.error || result?.message || 'Failed to send OTP';
      if (typeof errMsg !== 'string') errMsg = 'Failed to send OTP';

      if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('already registered')) {
        errMsg = 'An account with this email already exists. Please sign in instead.';
      } else if (response.status === 429 || errMsg.includes('30 minutes') || errMsg.toLowerCase().includes('too many') || errMsg.toLowerCase().includes('rate')) {
        errMsg = 'Too many requests. Please try after some time.';
      }
      throw new Error(errMsg);
    }

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Server returned an invalid response format.');
    }

    console.log('[HTTP] response:', result);
    return result;
  } catch (error: any) {
    console.error('[HTTP] error:', error);
    let errMsg = error.message || 'Failed to send OTP';
    if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('bad request')) {
      errMsg = 'An account with this email already exists. Please sign in instead.';
    } else if (errMsg.includes('30 minutes') || errMsg.toLowerCase().includes('too many')) {
      errMsg = 'Too many requests. Please try after some time.';
    }
    throw new Error(errMsg);
  }
};

/* =========================================================
   🔑 VERIFY OTP (HTTP)
========================================================= */
export const verifyOTP = async (email: string, otp: string) => {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.trim();
  console.log("[OTP] Verifying:", trimmedEmail, trimmedOtp);

  try {
    const response = await fetch(
      "https://us-central1-splitmate-d2d66.cloudfunctions.net/verifyOTP",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: trimmedOtp,
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      if (response.status === 500 || response.status === 503 || responseText.includes('<html')) {
        throw new Error('Verification service is temporarily unavailable.');
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        if (responseText && responseText.length < 200) {
          throw new Error(responseText.trim());
        }
        throw new Error('Verification server returned an invalid response.');
      }
      console.warn("[OTP] Verification rejected by server:", result.error);
      throw new Error(result.error || "Invalid or expired OTP");
    }

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Verification server returned an invalid response.');
    }

    console.log("[OTP] verify response status:", response.status, result);
    return result;

  } catch (error: any) {
    console.error("[OTP] verify failed exception:", error);
    throw error;
  }
};

/* =========================================================
   🛠️ RESET PASSWORD WITH OTP (Callable)
========================================================= */
export const resetPasswordWithOTP = async (email: string, newPassword: string) => {
  console.log(`[OTP] Requesting password reset for: ${email}`);
  try {
    const reset = httpsCallable(functions, 'resetPasswordWithOTP');
    const result = await reset({ email: email.trim().toLowerCase(), newPassword });
    console.log('[OTP] resetPasswordWithOTP success:', result.data);
    return result.data;
  } catch (error: any) {
    console.error('[OTP] resetPasswordWithOTP failed:', error);
    throw new Error(error.message || 'Failed to update password');
  }
};

/* =========================================================
   🔥 PRE-WARM OTP SERVICE (Eliminates Cold Start Latency)
========================================================= */
export const warmUpOTPService = () => {
  fetch("https://us-central1-splitmate-d2d66.cloudfunctions.net/verifyOTP", {
    method: "OPTIONS",
  }).catch(() => { });
};

/* =========================================================
   📧 PASSWORD RESET & EMAIL VERIFICATION
========================================================= */
export const resetPassword = async (email: string): Promise<void> => {
  console.log(`[Auth] Sending password reset email to: ${email}`);
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
};

export const resendVerificationEmail = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user found.");
  console.log(`[Auth] Resending verification email to: ${user.email}`);
  await sendEmailVerification(user);
};

export const checkEmailVerified = async (): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  return user.emailVerified;
};

/* =========================================================
   🚀 SIGNUP
========================================================= */
export const signUpWithEmail = async (email: string, pass: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    setSentryUserContext({ uid: user.uid, email: user.email, displayName: user.displayName });
    TelemetryService.trackSignup('email');

    // Run Firestore document write asynchronously in background without blocking Auth completion
    setDoc(
      doc(db, "users", user.uid),
      {
        email: email.toLowerCase(),
        isVerified: true,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((e) => console.warn("[Auth] Background setDoc error:", e));

    return user;
  } catch (error: any) {
    captureError(error, { tags: { location: 'authService', action: 'signUpWithEmail' } });
    throw error;
  }
};

/* =========================================================
   🔐 LOGIN
========================================================= */
export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    setSentryUserContext({ uid: user.uid, email: user.email, displayName: user.displayName });
    TelemetryService.trackLogin('email');

    return user;
  } catch (error: any) {
    captureError(error, { tags: { location: 'authService', action: 'signInWithEmail' } });
    throw error;
  }
};

/* =========================================================
   👤 UPDATE PROFILE
========================================================= */
export const updateUserProfile = async (
  displayName: string,
  photoURL?: string
): Promise<void> => {
  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: photoURL || null,
      });
      setSentryUserContext({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName,
      });
      TelemetryService.trackProfileUpdated();
    }
  } catch (error: any) {
    captureError(error, { tags: { location: 'authService', action: 'updateUserProfile' } });
    throw error;
  }
};

/* =========================================================
   🚪 LOGOUT
========================================================= */
export const signOutUser = async (): Promise<void> => {
  try {
    await NotificationService.unregisterPushToken();
  } catch (e) {
    console.warn('[Auth] Error unregistering push token on sign out:', e);
  }
  clearSentryUserContext();
  await signOut(auth);
};

/* =========================================================
   👤 CURRENT USER
========================================================= */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/* =========================================================
   🔑 CHANGE PASSWORD
========================================================= */
export const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user found.');

  if (!currentPassword) {
    throw new Error('Please enter your current password.');
  }

  // First re-authenticate with current password to verify identity
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);


  // Then update password
  await updatePassword(user, newPassword);
};

/* =========================================================
   ❌ DELETE ACCOUNT
========================================================= */
export const deleteUserAccount = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user found.');

  // 1. Unregister push token
  try {
    await NotificationService.unregisterPushToken();
  } catch (e) {
    console.warn('[Auth] Error unregistering push token during account deletion:', e);
  }

  // 2. Delete PIN hash local security setting if set
  try {
    await deletePinHash();
  } catch (e) {
    console.warn('[Auth] Error deleting PIN hash:', e);
  }

  // 3. Perform comprehensive cleanup in Firestore (remove from all groups, invitations, contacts & delete user doc)
  try {
    await cleanupUserFromFirestore(user.uid);
  } catch (e) {
    console.warn('[Auth] Error cleaning up user data in Firestore:', e);
  }

  // 4. Delete user from Firebase Auth
  await deleteUser(user);
};

/* =========================================================
   🔑 RE-AUTHENTICATION HELPERS FOR SENSITIVE ACTIONS
========================================================= */
export const reauthenticateEmailUser = async (password: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user email found.');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
};

export const reauthenticateGoogleUser = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user found.');

  if (Platform.OS === 'web') {
    throw new Error('Google re-authentication is not supported on web.');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    await GoogleSignin.signOut();
  } catch (e) {}

  const userInfo = await GoogleSignin.signIn();
  const idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;

  let finalIdToken = idToken;
  if (!finalIdToken) {
    const tokens = await GoogleSignin.getTokens();
    finalIdToken = tokens.idToken;
  }

  if (!finalIdToken) throw new Error('Could not retrieve ID Token from Google.');

  const credential = GoogleAuthProvider.credential(finalIdToken);
  await reauthenticateWithCredential(user, credential);
};