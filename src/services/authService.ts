import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app, WEB_CLIENT_ID } from "../config/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { NotificationService } from "./NotificationService";

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
    } catch (e) {}

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

    const result = await response.json();
    console.log('[HTTP] response:', result);

    if (!response.ok) {
      let errMsg = result?.error || result?.message || 'Failed to send OTP';
      if (typeof errMsg !== 'string') errMsg = 'Failed to send OTP';

      if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('already registered')) {
        errMsg = 'An account with this email already exists. Please sign in instead.';
      } else if (response.status === 429 || errMsg.includes('30 minutes') || errMsg.toLowerCase().includes('too many')) {
        errMsg = 'Too many requests. Please try after some time.';
      } else if (response.status === 400) {
        errMsg = 'An account with this email already exists. Please sign in instead.';
      }
      throw new Error(errMsg);
    }

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

    const result = await response.json();
    console.log("[OTP] verify response status:", response.status, result);

    if (!response.ok) {
      console.warn("[OTP] Verification rejected by server:", result.error);
      throw new Error(result.error || "Invalid or expired OTP");
    }

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
  }).catch(() => {});
};

/* =========================================================
   🚀 SIGNUP
========================================================= */
export const signUpWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

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
};

/* =========================================================
   🔐 LOGIN
========================================================= */
export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
};

/* =========================================================
   👤 UPDATE PROFILE
========================================================= */
export const updateUserProfile = async (
  displayName: string,
  photoURL?: string
): Promise<void> => {
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL: photoURL || null,
    });
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
  await signOut(auth);
};

/* =========================================================
   👤 CURRENT USER
========================================================= */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};