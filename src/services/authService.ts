import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, app } from "../config/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const functions = getFunctions(app, 'us-central1');

/* =========================================================
   📧 SEND OTP (HTTP)
========================================================= */
export const sendOTPEmailHTTP = async (email: string) => {
  console.log(`[HTTP] Calling sendOTPEmailTest for: ${email}`);
  const url = 'https://us-central1-splitmate-d2d66.cloudfunctions.net/sendOTPEmailTest';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const result = await response.json();
    console.log('[HTTP] response:', result);

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send OTP');
    }

    return result;
  } catch (error: any) {
    console.error('[HTTP] error:', error);
    throw error;
  }
};

/* =========================================================
   🔑 VERIFY OTP (HTTP)
========================================================= */
export const verifyOTP = async (email: string, otp: string) => {
  console.log("[OTP] Verifying:", email, otp);

  try {
    const response = await fetch(
      "https://us-central1-splitmate-d2d66.cloudfunctions.net/verifyOTP",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp,
        }),
      }
    );

    const result = await response.json();
    console.log("[OTP] verify response:", result);

    if (!response.ok) {
      throw new Error(result.error || "Invalid or expired OTP");
    }

    return result;

  } catch (error: any) {
    console.error("[OTP] verify failed:", error);
    throw new Error(error.message || "OTP verification failed");
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
   🚀 SIGNUP
========================================================= */
export const signUpWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: email.toLowerCase(),
      isVerified: false,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

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
  await signOut(auth);
};

/* =========================================================
   👤 CURRENT USER
========================================================= */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};