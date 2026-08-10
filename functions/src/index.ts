import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { Timestamp } from "firebase-admin/firestore";


import * as SibApiV3Sdk from "sib-api-v3-sdk";

// ✅ INIT
initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

// ================= SECRETS =================
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");

// ================= SEND OTP (HTTP onRequest) =================
// Merged logic from sendOTPEmail and sendOTPEmailTest
export const sendOTPEmailTest = onRequest({ secrets: [BREVO_API_KEY] }, async (req, res) => {
  try {
    const email = req.body?.email?.toString().trim().toLowerCase();
    const mode = req.body?.mode || 'none'; // 'signup' | 'reset' | 'none'
    console.log(`[OTP] Request for: ${email}, Mode: ${mode}`);

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    // ✅ ACCOUNT EXISTENCE CHECKS
    if (mode === 'signup') {
      try {
        await auth.getUserByEmail(email);
        res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
        return;
      } catch (e: any) {
        if (e.code !== 'auth/user-not-found') throw e;
        // User not found = Good for signup
      }
    } else if (mode === 'reset') {
      try {
        await auth.getUserByEmail(email);
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          res.status(404).json({ error: "No account found with this email. Please sign up first." });
          return;
        }
        throw e;
      }
    }

    const now = Date.now();

    // --- RATE LIMITING (3 per 30 mins) ---
    const limitRef = db.collection("otpRateLimits").doc(email);
    const WINDOW_MS = 30 * 60 * 1000;

    const rateLimitExceeded = await db.runTransaction(async (transaction) => {
      const limitDoc = await transaction.get(limitRef);
      const limitData = limitDoc.data();

      if (!limitDoc.exists || (now - (limitData?.windowStart || 0) > WINDOW_MS)) {
        transaction.set(limitRef, { count: 1, windowStart: now });
        return false;
      } else {
        if (limitData?.count >= 3) {
          return true;
        }
        transaction.update(limitRef, { count: (limitData?.count || 0) + 1 });
        return false;
      }
    });

    if (rateLimitExceeded) {
      res.status(429).json({ error: "Too many requests. Please try after some time." });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[OTP] Generated: ${otp} for ${email}`);

    // Save to Firestore
    await db.collection("otp_verifications").doc(email).set({
      email,
      otp,
      expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), // ✅ FIXED
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send Email
    const apiKeyVal = BREVO_API_KEY.value();
    if (!apiKeyVal) {
      console.error("[OTP] BREVO_API_KEY is not set!");
      throw new Error("Email service configuration error");
    }

    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = apiKeyVal;
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Your OTP Code";
    sendSmtpEmail.textContent = `Your OTP is ${otp}`;
    sendSmtpEmail.sender = { name: "SplitMate", email: "splitmate@fyndralabs.com" };
    sendSmtpEmail.to = [{ email }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[OTP] Email sent successfully to ${email}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[OTP] sendOTPEmailTest error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= VERIFY OTP (HTTP onRequest) =================
export const verifyOTP = onRequest({ cors: true }, async (req, res) => {
  // Handle pre-warm / OPTIONS ping instantly
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }

  try {
    const email = req.body?.email?.toString().trim().toLowerCase();
    const code = req.body?.otp?.toString().trim();

    if (!email || !code) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }

    console.log(`[OTP] Verifying: ${email}, Code Provided: ${code}`);

    const otpRef = db.collection("otp_verifications").doc(email);
    const snap = await otpRef.get();

    if (!snap.exists) {
      res.status(404).json({ error: "No active OTP found. Please request a new one." });
      return;
    }

    const otpData = snap.data();
    const expiryMs = otpData?.expiresAt?.toMillis() || 0;
    const nowMs = Date.now();

    console.log(`[OTP] Checking Expiry - Now: ${nowMs}, Expiry: ${expiryMs}, Diff: ${expiryMs - nowMs}ms`);

    // Check expiration using Timestamp.toMillis() with a 10s grace period for clock drift
    if (nowMs > (expiryMs + 10000)) {
      console.log(`[OTP] EXPIRED: ${email}. Now: ${nowMs}, Expiry: ${expiryMs}`);
      otpRef.delete().catch(() => {});
      res.status(400).json({ error: "OTP expired. Please request a new one." });
      return;
    }

    if (otpData?.otp !== code) {
      console.log(`[OTP] Mismatch: Expected ${otpData?.otp}, Got ${code}`);
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // Success - Mark as verified asynchronously without delaying client HTTP response
    otpRef.update({
      verified: true,
      verifiedAt: FieldValue.serverTimestamp()
    }).catch(e => console.warn("[OTP] Background doc update error:", e));

    console.log(`[OTP] SUCCESS: ${email} verified`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[OTP] verifyOTP error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= RESET PASSWORD WITH OTP (Callable) =================
export const resetPasswordWithOTP = onCall(async (request) => {
  const email = request.data?.email?.toString().trim().toLowerCase();
  const newPassword = request.data?.newPassword;

  if (!email || !newPassword) {
    throw new HttpsError("invalid-argument", "Email and newPassword are required.");
  }

  if (newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  console.log(`[OTP] Resetting password for: ${email}`);

  const otpRef = db.collection("otp_verifications").doc(email);
  const snap = await otpRef.get();

  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "OTP verification required. Please verify your OTP again.");
  }

  const otpData = snap.data();
  const expiryMs = otpData?.expiresAt.toMillis();
  const nowMs = Date.now();

  if (!otpData?.verified) {
    throw new HttpsError("failed-precondition", "OTP verification required.");
  }

  // Check if still not expired with a 10s grace period
  if (nowMs > (expiryMs + 10000)) {
    console.log(`[OTP] EXPIRED during reset: ${email}. Now: ${nowMs}, Expiry: ${expiryMs}`);
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "OTP expired. Please request a new one.");
  }

  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password: newPassword });

    // ✅ DELETE OTP doc only after successful password update
    await otpRef.delete();

    console.log(`[OTP] Password successfully reset for: ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error("[OTP] resetPasswordWithOTP error:", error);
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "No user found with this email.");
    }
    throw new HttpsError("internal", error.message || "Failed to update password.");
  }
});

// ================= PUSH NOTIFICATION =================
export const onExpenseCreated = onDocumentCreated(
  "expenses/{expenseId}",
  async (event) => {
    const expense = event.data?.data();
    if (!expense) return;

    const { groupId, title, amount, paidBy, paidByName } = expense;

    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) return;

    const groupData = groupSnap.data();
    const members: string[] = groupData?.memberIds || [];
    const groupName = groupData?.name || "Group";

    const targets = members.filter((uid) => uid !== paidBy);

    const tokens: string[] = [];

    const users = await Promise.all(
      targets.map((uid) => db.collection("users").doc(uid).get())
    );

    users.forEach((u: any) => {
      const token = u.data()?.fcmToken;
      if (token) tokens.push(token);
    });

    if (!tokens.length) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "New Expense Added",
        body: `${paidByName || "Someone"} added ₹${amount} for "${title}" in ${groupName}`,
      },
      data: {
        type: "EXPENSE",
        groupId,
        expenseId: event.params.expenseId,
      },
      android: { priority: "high" },
    });
  }
);
