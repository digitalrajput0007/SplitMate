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
exports.onExpenseCreated = exports.resetPasswordWithOTP = exports.verifyOTP = exports.sendOTPEmailTest = exports.sendOTPEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const messaging_1 = require("firebase-admin/messaging");
const SibApiV3Sdk = __importStar(require("sib-api-v3-sdk"));
// ✅ INIT
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const auth = (0, auth_1.getAuth)();
const messaging = (0, messaging_1.getMessaging)();
// ================= SECRETS =================
const BREVO_API_KEY = (0, params_1.defineSecret)("BREVO_API_KEY");
// ================= SEND OTP =================
// Note: onCall functions are public by default regarding request.auth.
// If you get 'unauthenticated', ensure the IAM policy for this function
// allows 'allUsers' to have the 'Cloud Functions Invoker' role.
exports.sendOTPEmail = (0, https_1.onCall)({ secrets: [BREVO_API_KEY] }, async (request) => {
    const { email } = request.data;
    console.log("OTP request for:", email);
    if (!email || !email.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "Valid email required");
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
            createdAt: firestore_2.FieldValue.serverTimestamp(),
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
        }
        else {
            console.log(`[TEST MODE] OTP for ${email}: ${otp}`);
        }
        return { success: true };
    }
    catch (error) {
        console.error("Callable OTP error:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Unknown error occurred");
    }
});
// ================= SEND OTP TEST (HTTP onRequest) =================
exports.sendOTPEmailTest = (0, https_1.onRequest)({ secrets: [BREVO_API_KEY] }, async (req, res) => {
    var _a, _b;
    try {
        const email = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
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
            createdAt: firestore_2.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        console.error("❌ OTP ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});
// ================= VERIFY OTP =================
exports.verifyOTP = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b, _c;
    try {
        const email = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
        const code = (_c = req.body) === null || _c === void 0 ? void 0 : _c.otp;
        if (!email || !code) {
            res.status(400).json({ error: "Email and OTP required" });
            return;
        }
        const otpRef = db.collection("otp_verifications").doc(email);
        const snap = await otpRef.get();
        if (!snap.exists) {
            res.status(404).json({ error: "No OTP found" });
            return;
        }
        const otpData = snap.data();
        if (Date.now() > (otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt)) {
            await otpRef.delete();
            res.status(400).json({ error: "OTP expired" });
            return;
        }
        if ((otpData === null || otpData === void 0 ? void 0 : otpData.otp) !== code) {
            res.status(400).json({ error: "Invalid OTP" });
            return;
        }
        await otpRef.update({ verified: true });
        res.json({ success: true });
    }
    catch (error) {
        console.error("VERIFY ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});
// ================= RESET PASSWORD WITH OTP =================
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
    const otpRef = db.collection("otp_verifications").doc(email);
    const snap = await otpRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("failed-precondition", "OTP verification required");
    }
    const otpData = snap.data();
    if (!(otpData === null || otpData === void 0 ? void 0 : otpData.verified)) {
        throw new https_1.HttpsError("failed-precondition", "OTP not verified");
    }
    // Check if still not expired
    if (Date.now() > (otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt)) {
        await otpRef.delete();
        throw new https_1.HttpsError("deadline-exceeded", "OTP expired");
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
    }
    catch (error) {
        console.error("❌ Password reset failed:", error);
        if (error.code === "auth/user-not-found") {
            throw new https_1.HttpsError("not-found", "No user found with this email.");
        }
        throw new https_1.HttpsError("internal", "Failed to update password.");
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
