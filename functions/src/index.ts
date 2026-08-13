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

// ================= REUSABLE OTP EMAIL TEMPLATE GENERATOR =================
export function generateOTPEmailHTML(options: { mode: 'signup' | 'reset' | string; otp: string }) {
  const isSignup = options.mode === 'signup';

  const subject = isSignup
    ? "Your SplitMate verification code"
    : "Your SplitMate password reset code";

  const heading = isSignup
    ? "Verify your email"
    : "Reset your password";

  const bodyLine1 = isSignup
    ? "Welcome to SplitMate!"
    : "We received a request to reset your SplitMate account password.";

  const bodyLine2 = isSignup
    ? "Use the verification code below to complete your account setup."
    : "Use the verification code below to continue.";

  const additionalMessage = isSignup
    ? "If you didn't request this code, you can safely ignore this email."
    : "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.";

  const textContent = `${heading}\n\n${bodyLine1}\n${bodyLine2}\n\nOTP: ${options.otp}\n\nThis code expires in 10 minutes.\nNever share this code with anyone.\n\n${additionalMessage}\n\nSplitMate - Simple expense sharing for everyone.\n© 2026 SplitMate`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; word-spacing: normal;">
  <div style="background-color: #F8FAFC; width: 100%; padding: 40px 0;">
    <!--[if mso]>
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="560">
    <tr>
    <td>
    <![endif]-->
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
      
      <!-- HEADER -->
      <tr>
        <td align="center" style="padding: 36px 36px 20px 36px; text-align: center;">
          <img
            src="https://ik.imagekit.io/splitmateapp/notification_large.png"
            alt="SplitMate"
            width="64"
            height="64"
            style="
              display:block;
              margin: 0 auto;
              width:64px !important;
              height:64px !important;
              max-width:64px !important;
              max-height:64px !important;
              min-width:64px !important;
              min-height:64px !important;
              object-fit:contain;
              border:0;
              outline:none;
              text-decoration:none;
            "
          />
        </td>
      </tr>

      <!-- BODY CONTENT -->
      <tr>
        <td style="padding: 0 36px 36px 36px;">
          <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0F172A; letter-spacing: -0.5px;">${heading}</h1>
          
          <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 24px; color: #334155; font-weight: 500;">
            ${bodyLine1}
          </p>
          <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 24px; color: #475569;">
            ${bodyLine2}
          </p>

          <!-- OTP CONTAINER -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 24px; text-align: center;">
                <div style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1E40AF; margin: 0; padding-left: 10px;">${options.otp}</div>
              </td>
            </tr>
          </table>

          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; font-weight: 600; text-align: center;">
            This code expires in 10 minutes.
          </p>

          <div style="background-color: #FEF2F2; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #991B1B; font-weight: 600;">
              🔒 Never share this code with anyone.
            </p>
          </div>

          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #64748B; border-top: 1px solid #F1F5F9; padding-top: 20px;">
            ${additionalMessage}
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding: 24px 36px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #334155;">SplitMate</p>
          <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748B;">Simple expense sharing for everyone.</p>
          
          <p style="margin: 0 0 14px 0; font-size: 12px; color: #64748B;">
            <a href="https://splitmate.app/privacy" style="color: #2563EB; text-decoration: none; font-weight: 500;">Privacy Policy</a> &nbsp;•&nbsp; 
            <a href="https://splitmate.app/terms" style="color: #2563EB; text-decoration: none; font-weight: 500;">Terms</a> &nbsp;•&nbsp; 
            <a href="https://splitmate.app/help" style="color: #2563EB; text-decoration: none; font-weight: 500;">Help</a>
          </p>

          <p style="margin: 0; font-size: 12px; color: #94A3B8;">© 2026 SplitMate</p>
        </td>
      </tr>
    </table>
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </div>
</body>
</html>`;

  return { subject, htmlContent, textContent };
}

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

    // Save to Firestore with 10 min expiration
    await db.collection("otp_verifications").doc(email).set({
      email,
      otp,
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
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

    const emailData = generateOTPEmailHTML({ mode, otp });

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.htmlContent = emailData.htmlContent;
    sendSmtpEmail.textContent = emailData.textContent;
    sendSmtpEmail.sender = { name: "SplitMate", email: "splitmate@fyndralabs.com" };
    sendSmtpEmail.to = [{ email }];

    try {
      await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`[OTP] Email sent successfully to ${email}`);
      res.json({ success: true });
    } catch (emailErr: any) {
      console.error("[OTP] Brevo API Error:", emailErr?.response?.body || emailErr?.response?.text || emailErr?.message || emailErr);
      const detail = emailErr?.response?.body?.message || emailErr?.response?.text || emailErr?.message || "Failed to send OTP email";
      res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
      return;
    }
  } catch (error: any) {
    console.error("[OTP] sendOTPEmailTest error:", error);
    res.status(500).json({ error: error.message || "Failed to send OTP" });
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
      otpRef.delete().catch(() => { });
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
      android: {
        priority: "high",
        notification: {
          icon: "notification_icon",
          color: "#0065F2",
        },
      },
    });
  }
);
