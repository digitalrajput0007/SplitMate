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
exports.onExpenseCreated = exports.verifyOTP = exports.sendOTPEmail = void 0;
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
exports.sendOTPEmail = (0, https_1.onCall)({ secrets: [BREVO_API_KEY] }, async (request) => {
    var _a, _b;
    const email = (_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toString().trim().toLowerCase();
    if (!email || !email.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "Valid email required");
    }
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await db.collection("otpCodes").doc(email).set({
        email,
        otpCode,
        expiresAt,
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
        sendSmtpEmail.textContent = `Your OTP is ${otpCode}`;
        sendSmtpEmail.sender = { name: "SplitMate", email: "splitmate@fyndralabs.com" };
        sendSmtpEmail.to = [{ email: email }];
        try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
        }
        catch (error) {
            console.error("Brevo error:", error);
        }
    }
    else {
        console.log(`[TEST MODE] OTP for ${email}: ${otpCode}`);
    }
    return { success: true };
});
// ================= VERIFY OTP =================
exports.verifyOTP = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const email = (_a = request.data) === null || _a === void 0 ? void 0 : _a.email;
    const code = (_b = request.data) === null || _b === void 0 ? void 0 : _b.code;
    if (!email || !code) {
        throw new https_1.HttpsError("invalid-argument", "Email and code required");
    }
    const snap = await db.collection("otpCodes").doc(email.toLowerCase()).get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "No OTP found");
    }
    const otpData = snap.data();
    if (Date.now() > (otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt)) {
        await snap.ref.delete();
        throw new https_1.HttpsError("deadline-exceeded", "Expired");
    }
    if ((otpData === null || otpData === void 0 ? void 0 : otpData.otpCode) !== code) {
        throw new https_1.HttpsError("invalid-argument", "Invalid OTP");
    }
    await snap.ref.delete();
    let user;
    try {
        user = await auth.getUserByEmail(email);
    }
    catch (_c) {
        user = await auth.createUser({ email, emailVerified: true });
    }
    const token = await auth.createCustomToken(user.uid);
    return { success: true, token, uid: user.uid };
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
