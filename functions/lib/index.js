"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onExpenseCreated = exports.resetPasswordWithOTP = exports.verifyOTP = exports.sendOTPEmailTest = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const messaging_1 = require("firebase-admin/messaging");
const firestore_3 = require("firebase-admin/firestore");
const SibApiV3Sdk = __importStar(require("sib-api-v3-sdk"));
// ✅ INIT
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const auth = (0, auth_1.getAuth)();
const messaging = (0, messaging_1.getMessaging)();
// ================= SECRETS =================
const BREVO_API_KEY = (0, params_1.defineSecret)("BREVO_API_KEY");
// ================= SEND OTP (HTTP onRequest) =================
// Merged logic from sendOTPEmail and sendOTPEmailTest
exports.sendOTPEmailTest = (0, https_1.onRequest)({ secrets: [BREVO_API_KEY] }, async (req, res) => {
    var _a, _b, _c;
    try {
        const email = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
        const mode = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.mode) || 'none'; // 'signup' | 'reset' | 'none'
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
            }
            catch (e) {
                if (e.code !== 'auth/user-not-found')
                    throw e;
                // User not found = Good for signup
            }
        }
        else if (mode === 'reset') {
            try {
                await auth.getUserByEmail(email);
            }
            catch (e) {
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
            if (!limitDoc.exists || (now - ((limitData === null || limitData === void 0 ? void 0 : limitData.windowStart) || 0) > WINDOW_MS)) {
                transaction.set(limitRef, { count: 1, windowStart: now });
                return false;
            }
            else {
                if ((limitData === null || limitData === void 0 ? void 0 : limitData.count) >= 3) {
                    return true;
                }
                transaction.update(limitRef, { count: ((limitData === null || limitData === void 0 ? void 0 : limitData.count) || 0) + 1 });
                return false;
            }
        });
        if (rateLimitExceeded) {
            res.status(429).json({ error: "Too many requests. Please wait 30 minutes." });
            return;
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[OTP] Generated: ${otp} for ${email}`);
        // Save to Firestore
        await db.collection("otp_verifications").doc(email).set({
            email,
            otp,
            expiresAt: firestore_3.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), // ✅ FIXED
            verified: false,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        console.error("[OTP] sendOTPEmailTest error:", error);
        res.status(500).json({ error: error.message });
    }
});
// ================= VERIFY OTP (HTTP onRequest) =================
exports.verifyOTP = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const email = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
        const code = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.otp) === null || _d === void 0 ? void 0 : _d.toString().trim();
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
        const expiryMs = otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt.toMillis();
        const nowMs = Date.now();
        console.log(`[OTP] Checking Expiry - Now: ${nowMs}, Expiry: ${expiryMs}, Diff: ${expiryMs - nowMs}ms`);
        // Check expiration using Timestamp.toMillis() with a 10s grace period for clock drift
        if (nowMs > (expiryMs + 10000)) {
            console.log(`[OTP] EXPIRED: ${email}. Now: ${nowMs}, Expiry: ${expiryMs}`);
            await otpRef.delete();
            res.status(400).json({ error: "OTP expired. Please request a new one." });
            return;
        }
        if ((otpData === null || otpData === void 0 ? void 0 : otpData.otp) !== code) {
            console.log(`[OTP] Mismatch: Expected ${otpData === null || otpData === void 0 ? void 0 : otpData.otp}, Got ${code}`);
            res.status(400).json({ error: "Invalid OTP" });
            return;
        }
        // Success - Mark as verified but keep doc for resetPasswordWithOTP
        await otpRef.update({
            verified: true,
            verifiedAt: firestore_2.FieldValue.serverTimestamp()
        });
        console.log(`[OTP] SUCCESS: ${email} verified`);
        res.json({ success: true });
    }
    catch (error) {
        console.error("[OTP] verifyOTP error:", error);
        res.status(500).json({ error: error.message });
    }
});
// ================= RESET PASSWORD WITH OTP (Callable) =================
exports.resetPasswordWithOTP = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    const email = (_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
    const newPassword = (_c = request.data) === null || _c === void 0 ? void 0 : _c.newPassword;
    if (!email || !newPassword) {
        throw new https_1.HttpsError("invalid-argument", "Email and newPassword are required.");
    }
    if (newPassword.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    console.log(`[OTP] Resetting password for: ${email}`);
    const otpRef = db.collection("otp_verifications").doc(email);
    const snap = await otpRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("failed-precondition", "OTP verification required. Please verify your OTP again.");
    }
    const otpData = snap.data();
    const expiryMs = otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt.toMillis();
    const nowMs = Date.now();
    if (!(otpData === null || otpData === void 0 ? void 0 : otpData.verified)) {
        throw new https_1.HttpsError("failed-precondition", "OTP verification required.");
    }
    // Check if still not expired with a 10s grace period
    if (nowMs > (expiryMs + 10000)) {
        console.log(`[OTP] EXPIRED during reset: ${email}. Now: ${nowMs}, Expiry: ${expiryMs}`);
        await otpRef.delete();
        throw new https_1.HttpsError("deadline-exceeded", "OTP expired. Please request a new one.");
    }
    try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password: newPassword });
        // ✅ DELETE OTP doc only after successful password update
        await otpRef.delete();
        console.log(`[OTP] Password successfully reset for: ${email}`);
        return { success: true };
    }
    catch (error) {
        console.error("[OTP] resetPasswordWithOTP error:", error);
        if (error.code === "auth/user-not-found") {
            throw new https_1.HttpsError("not-found", "No user found with this email.");
        }
        throw new https_1.HttpsError("internal", error.message || "Failed to update password.");
    }
});
// ================= PUSH NOTIFICATION =================
exports.onExpenseCreated = (0, firestore_1.onDocumentCreated)("expenses/{expenseId}", async (event) => {
    var _a;
    const expense = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!expense)
        return;
    const { groupId, title, amount, paidBy, paidByName } = expense;
    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists)
        return;
    const groupData = groupSnap.data();
    const members = (groupData === null || groupData === void 0 ? void 0 : groupData.memberIds) || [];
    const groupName = (groupData === null || groupData === void 0 ? void 0 : groupData.name) || "Group";
    const targets = members.filter((uid) => uid !== paidBy);
    const tokens = [];
    const users = await Promise.all(targets.map((uid) => db.collection("users").doc(uid).get()));
    users.forEach((u) => {
        var _a;
        const token = (_a = u.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
        if (token)
            tokens.push(token);
    });
    if (!tokens.length)
        return;
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
});
