const admin = require('c:/SplitMate/functions/node_modules/firebase-admin');
const path = require('path');

const serviceAccountPath = path.join('C:', 'SplitMate', 'splitmate-d2d66-firebase-adminsdk-fbsvc-c01c280d7f.json');
const serviceAccount = require(serviceAccountPath);

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

const REQUEST_ID = "DEL-959BBC";
const TARGET_UID = "vOEcAj3SFzcJxNVoLJFOcfOrCof2";

async function preCheck() {
  console.log("=== PRE-EXECUTION READ-ONLY INSPECTION ===");
  const docSnap = await db.collection("deletionRequests").doc(REQUEST_ID).get();
  if (!docSnap.exists) {
    throw new Error(`Request ${REQUEST_ID} not found.`);
  }
  const data = docSnap.data();
  console.log("Request status:", data.status);
  console.log("targetUid:", data.targetUid);

  if (data.status !== "FAILED_PROCESSING") {
    throw new Error(`Expected status FAILED_PROCESSING, but got ${data.status}`);
  }
  if (data.targetUid !== TARGET_UID) {
    throw new Error(`Expected targetUid ${TARGET_UID}, but got ${data.targetUid}`);
  }

  let authExists = false;
  try {
    const u = await auth.getUser(TARGET_UID);
    authExists = true;
    console.log("Auth Account Status: STILL EXISTS (email: " + u.email + ")");
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log("Auth Account Status: AUTH_DELETED");
    } else {
      console.log("Auth Error:", err);
    }
  }

  if (!authExists) {
    throw new Error("Expected Auth user to still exist before running repair execution.");
  }

  console.log("Pre-execution read-only inspection PASSED!\n");
}

preCheck().catch(console.error);
