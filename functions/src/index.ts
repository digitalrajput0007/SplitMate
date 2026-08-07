import { onCall, HttpsError } from "firebase-functions/v2/https";
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
export const sendOTPEmail = onCall({ secrets: [BREVO_API_KEY] }, async (request) => {
  const email = request.data?.email?.toString().trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "Valid email required");
  }

  const now = Date.now();
  const otpRef = db.collection("otpCodes").doc(email);
  const otpSnap = await otpRef.get();
  const otpData = otpSnap.data();

  let otpCode = "";
  let expiresAt = 0;

  // --- RESEND & REUSE LOGIC ---
  if (otpSnap.exists && otpData) {
    const lastSentAt = otpData.lastSentAt || 0;

    // 1. 30-second cooldown
    if (now - lastSentAt < 30000) {
      throw new HttpsError("failed-precondition", "Please wait 30 seconds before resending");
    }

    // 2. Reuse same OTP if still valid
    if (now < otpData.expiresAt) {
      otpCode = otpData.otpCode;
      expiresAt = otpData.expiresAt;
      console.log(`Reusing existing OTP for ${email}`);
    }
  }

  // 3. Generate new OTP if needed
  if (!otpCode) {
    otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    expiresAt = now + 10 * 60 * 1000; // 10 mins validity
    console.log(`Generated new OTP for ${email}`);
  }

  // --- RATE LIMITING LOGIC (3 per 10 mins) ---
  const limitRef = db.collection("otpRateLimits").doc(email);
  const WINDOW_MS = 10 * 60 * 1000;

  await db.runTransaction(async (transaction) => {
    const limitDoc = await transaction.get(limitRef);
    const limitData = limitDoc.data();

    if (!limitDoc.exists || (now - (limitData?.windowStart || 0) > WINDOW_MS)) {
      transaction.set(limitRef, { count: 1, windowStart: now });
    } else {
      if (limitData?.count >= 3) {
        throw new HttpsError("resource-exhausted", "Too many requests, try later");
      }
      transaction.update(limitRef, { count: (limitData?.count || 0) + 1 });
    }
  });

  // Save/Update the OTP and record lastSentAt
  await otpRef.set({
    email,
    otpCode,
    expiresAt,
    lastSentAt: now,
    createdAt: otpData?.createdAt || FieldValue.serverTimestamp(),
  });

  const apiKeyVal = BREVO_API_KEY.value();

  if (apiKeyVal) {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications["api-key"];
    apiKey.apiKey = apiKeyVal;
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Your OTP Code";
    sendSmtpEmail.textContent = `Your OTP is ${otpCode}`;
    sendSmtpEmail.sender = { name: "SplitMate", email: "splitmate@fyndralabs.com" };
    sendSmtpEmail.to = [{ email: email }];

    try {
      await apiInstance.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      console.error("Brevo error:", error);
    }
  } else {
    console.log(`[TEST MODE] OTP for ${email}: ${otpCode}`);
  }

  return { success: true };
});

// ================= VERIFY OTP =================
export const verifyOTP = onCall(async (request) => {
  const email = request.data?.email;
  const code = request.data?.code;

  if (!email || !code) {
    throw new HttpsError("invalid-argument", "Email and code required");
  }

  const snap = await db.collection("otpCodes").doc(email.toLowerCase()).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No OTP found");
  }

  const otpData = snap.data();

  if (Date.now() > otpData?.expiresAt) {
    await snap.ref.delete();
    throw new HttpsError("deadline-exceeded", "Expired");
  }

  if (otpData?.otpCode !== code) {
    throw new HttpsError("invalid-argument", "Invalid OTP");
  }

  await snap.ref.delete();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, emailVerified: true });
  }

  const token = await auth.createCustomToken(user.uid);

  return { success: true, token, uid: user.uid };
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
