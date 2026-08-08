import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

import * as SibApiV3Sdk from "sib-api-v3-sdk";

// ✅ INIT
initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

// ================= SECRETS =================
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");

// ================= SEND OTP =================
// Note: onCall functions are public by default regarding request.auth.
// If you get 'unauthenticated', ensure the IAM policy for this function
// allows 'allUsers' to have the 'Cloud Functions Invoker' role.
export const sendOTPEmail = onCall({ secrets: [BREVO_API_KEY] }, async (request) => {
  const { email } = request.data;
  console.log("OTP request for:", email);

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "Valid email required");
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Callable OTP:", otp);

    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 mins

    // Save to Firestore (Required for verification)
    const otpRef = db.collection("otp_verifications").doc(email.toLowerCase());
    await otpRef.set({
      email: email.toLowerCase(),
      otp,
      expiresAt,
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const apiKeyVal = BREVO_API_KEY.value();

    if (apiKeyVal) {
      const defaultClient = SibApiV3Sdk.ApiClient.instance;
      const apiKey = defaultClient.authentications["api-key"];
      apiKey.apiKey = apiKeyVal;
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = "Your OTP Code";
      sendSmtpEmail.textContent = `Your OTP is ${otp}`;
      sendSmtpEmail.sender = { name: "SplitMate", email: "splitmate@fyndralabs.com" };
      sendSmtpEmail.to = [{ email: email }];

      await apiInstance.sendTransacEmail(sendSmtpEmail);
    } else {
      console.log(`[TEST MODE] OTP for ${email}: ${otp}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Callable OTP error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Unknown error occurred");
  }
});

// ================= SEND OTP TEST (HTTP onRequest) =================
export const sendOTPEmailTest = onRequest({ secrets: [BREVO_API_KEY] }, async (req, res) => {
  try {
    const email = req.body?.email?.toString().trim().toLowerCase();
    console.log("Email:", email);

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("OTP:", otp);

    // ✅ SAVE OTP IN FIRESTORE
    await db.collection("otp_verifications").doc(email).set({
      email,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log("✅ OTP saved in Firestore");

    // ✅ GET SECRET (IMPORTANT: inside function only)
    const apiKeyVal = BREVO_API_KEY.value();
    console.log("🔥 KEY EXISTS:", !!apiKeyVal);

    if (!apiKeyVal) {
      throw new Error("BREVO API KEY MISSING");
    }

    // ✅ BREVO EMAIL SEND
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = apiKeyVal;

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Your OTP Code";
    sendSmtpEmail.textContent = `Your OTP is ${otp}`;
    sendSmtpEmail.sender = {
      name: "SplitMate",
      email: "splitmate@fyndralabs.com", // must be verified in Brevo
    };
    sendSmtpEmail.to = [{ email }];

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("📧 EMAIL RESPONSE:", response);

    res.json({ success: true });

  } catch (error: any) {
    console.error("❌ OTP ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= VERIFY OTP =================
export const verifyOTP = onRequest(async (req, res) => {
  try {
    const email = req.body?.email?.toString().trim().toLowerCase();
    const code = req.body?.otp;

    if (!email || !code) {
      res.status(400).json({ error: "Email and OTP required" });
      return;
    }

    console.log(`[OTP] Verifying for: ${email}, Code: ${code}`);

    const otpRef = db.collection("otp_verifications").doc(email);
    const snap = await otpRef.get();

    if (!snap.exists) {
      res.status(404).json({ error: "No OTP found" });
      return;
    }

    const otpData = snap.data();

    // Check expiration
    if (Date.now() > otpData?.expiresAt) {
      await otpRef.delete();
      res.status(400).json({ error: "OTP expired" });
      return;
    }

    // Check match
    if (otpData?.otp !== code) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // ✅ Success logic from requirement:
    // update verified = true, delete document
    await otpRef.update({ verified: true });
    await otpRef.delete();

    console.log(`[OTP] Success for: ${email}`);
    res.json({ success: true });

  } catch (error: any) {
    console.error("VERIFY ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= RESET PASSWORD WITH OTP =================
export const resetPasswordWithOTP = onCall(async (request) => {
  const email = request.data?.email?.toString().trim().toLowerCase();
  const newPassword = request.data?.newPassword;

  if (!email || !newPassword) {
    throw new HttpsError("invalid-argument", "Email and newPassword are required.");
  }

  if (newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  const otpRef = db.collection("otp_verifications").doc(email);
  const snap = await otpRef.get();

  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "OTP verification required");
  }

  const otpData = snap.data();

  if (!otpData?.verified) {
    throw new HttpsError("failed-precondition", "OTP not verified");
  }

  // Check if still not expired
  if (Date.now() > otpData?.expiresAt) {
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "OTP expired");
  }

  try {
    const userRecord = await auth.getUserByEmail(email);

    // Update the user's password directly in Firebase Auth
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Delete OTP after success
    await otpRef.delete();

    console.log(`✅ Password successfully reset for user: ${email}`);
    return { success: true };

  } catch (error: any) {
    console.error("❌ Password reset failed:", error);
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "No user found with this email.");
    }
    throw new HttpsError("internal", "Failed to update password.");
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
