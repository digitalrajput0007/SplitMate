import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

admin.initializeApp();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.key;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Cloud Function: sendOTPEmail
 * Generates 6-digit OTP, stores in Firestore otpCodes/{email}, and sends via SendGrid.
 */
export const sendOTPEmail = functions.https.onCall(async (data, context) => {
  const email = data?.email?.toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid email address is required.');
  }

  // 1. Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  // 2. Store in Firestore otpCodes/{email}
  const otpRef = admin.firestore().collection('otpCodes').doc(email);
  await otpRef.set({
    email,
    otpCode,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 3. Send email via SendGrid if configured
  if (SENDGRID_API_KEY) {
    try {
      const msg = {
        to: email,
        from: 'noreply@splitmate.app', // Update with verified SendGrid sender email
        subject: 'Your SplitMate OTP Code',
        text: `Your SplitMate verification code is: ${otpCode}. It expires in 10 minutes.`,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1F2937;">
          <h2>SplitMate Verification</h2>
          <p>Your 6-digit verification code is:</p>
          <h1 style="color: #4F46E5; letter-spacing: 4px;">${otpCode}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>`,
      };
      await sgMail.send(msg);
    } catch (err: any) {
      console.error('SendGrid Email Dispatch Error:', err?.response?.body || err);
    }
  } else {
    console.log(`[SendGrid Missing API Key] OTP for ${email}: ${otpCode}`);
  }

  return { success: true, message: 'OTP code sent successfully.' };
});

/**
 * Cloud Function: verifyOTP
 * Verifies code against Firestore and returns custom auth token on success.
 */
export const verifyOTP = functions.https.onCall(async (data, context) => {
  const email = data?.email?.toString().trim().toLowerCase();
  const enteredCode = data?.code?.toString().trim();

  if (!email || !enteredCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and 6-digit code are required.');
  }

  const otpRef = admin.firestore().collection('otpCodes').doc(email);
  const snap = await otpRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'No OTP requested for this email or code has expired.');
  }

  const otpData = snap.data();
  if (Date.now() > otpData?.expiresAt) {
    await otpRef.delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'OTP code has expired. Please request a new code.');
  }

  if (otpData?.otpCode !== enteredCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid OTP code. Please check your code and try again.');
  }

  // Clear OTP on successful match
  await otpRef.delete();

  // Retrieve or create user in Firebase Auth
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    userRecord = await admin.auth().createUser({ email, emailVerified: true });
  }

  // Generate custom token for client sign-in
  const customToken = await admin.auth().createCustomToken(userRecord.uid);
  return { success: true, customToken, uid: userRecord.uid };
});
