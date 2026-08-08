# Extend OTP System for Reset Password Flow

This plan outlines the steps to extend the existing OTP system in Firebase Cloud Functions to support a full password reset flow.

## Proposed Changes

### Firebase Cloud Functions

#### [MODIFY] [index.ts](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/functions/src/index.ts)

1.  **Update `sendOTPEmail`**:
    *   Change the collection name to `otp_verifications`.
    *   Set OTP expiration to 5 minutes.
    *   Update fields to include `email`, `otp`, `expiresAt`, and a `verified` flag.
    *   Maintain existing email sending logic using Brevo.

2.  **Update `verifyOTP`**:
    *   Validate the provided OTP against the `otp_verifications` collection.
    *   Check for expiration (5 minutes).
    *   If valid, update the document to set `verified: true`.
    *   Return `{ success: true }` or `{ success: false }`.

3.  **Implement `resetPasswordWithOTP`**:
    *   New callable function that takes `email` and `newPassword`.
    *   Verify that the corresponding document in `otp_verifications` has `verified: true`.
    *   Use Firebase Admin SDK to update the user's password.
    *   Delete the verification document upon successful password reset (Security: "Delete OTP after success").

## Verification Plan

### Automated Tests
*   I will verify the logic by inspecting the code for adherence to requirements:
    *   6-digit OTP generation.
    *   5-minute expiration.
    *   Correct collection and field names.
    *   Security checks for password reset.
    *   Deletion of OTP after success.

### Manual Verification
*   The user can deploy the functions and test the flow:
    1.  Call `sendOTPEmail` and receive an email.
    2.  Call `verifyOTP` with the received code.
    3.  Call `resetPasswordWithOTP` with the new password.
    4.  Verify that the password has been updated in Firebase Auth and the Firestore document is deleted.
