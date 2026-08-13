const admin = require('c:/SplitMate/functions/node_modules/firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'splitmate-d2d66-firebase-adminsdk-fbsvc-c01c280d7f.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const TARGET_REQ_ID = 'DEL-959BBC';
const TARGET_UID = 'vOEcAj3SFzcJxNVoLJFOcfOrCof2';
const TARGET_EMAIL = 'splitmate-phase6-test-1786532563220@yopmail.com';

async function runInvestigation() {
  console.log('=== STARTING READ-ONLY INVESTIGATION ===\n');

  // 1. CHECK DELETION REQUEST
  console.log('--- 1. DELETION REQUEST ---');
  const reqRef = db.collection('deletionRequests').doc(TARGET_REQ_ID);
  const reqSnap = await reqRef.get();
  let reqData = null;
  if (reqSnap.exists) {
    reqData = reqSnap.data();
    console.log('status:', reqData.status);
    console.log('requestVerificationStatus:', reqData.requestVerificationStatus);
    console.log('targetUid:', reqData.targetUid);
    console.log('deletionProgress:', JSON.stringify(reqData.deletionProgress, null, 2));
    console.log('failedStep:', reqData.failedStep);
    console.log('failureCode:', reqData.failureCode);
    console.log('completedAt:', reqData.completedAt ? (reqData.completedAt.toDate ? reqData.completedAt.toDate() : reqData.completedAt) : null);
    console.log('updatedAt:', reqData.updatedAt ? (reqData.updatedAt.toDate ? reqData.updatedAt.toDate() : reqData.updatedAt) : null);
  } else {
    console.log('deletionRequests/' + TARGET_REQ_ID + ' NOT FOUND');
  }

  // 2. CHECK AUDIT TRAIL
  console.log('\n--- 2. AUDIT TRAIL ---');
  const auditSnap = await reqRef.collection('audit').orderBy('timestamp', 'asc').get();
  console.log(`Found ${auditSnap.size} audit events:`);
  auditSnap.forEach(doc => {
    const data = doc.data();
    const ts = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : 'N/A';
    console.log(`- [${doc.id}] timestamp: ${ts}`);
    console.log('  data:', JSON.stringify(data, null, 2));
  });

  // Check subcollections if audit empty
  const collections = await reqRef.listCollections();
  console.log('Subcollections on deletionRequest:', collections.map(c => c.id));
  for (const col of collections) {
    if (col.id !== 'audit') {
      const snap = await col.get();
      console.log(`Subcollection ${col.id} has ${snap.size} docs:`);
      snap.forEach(d => console.log(' ', d.id, JSON.stringify(d.data(), null, 2)));
    }
  }

  // 3. CHECK FIREBASE AUTH
  console.log('\n--- 3. FIREBASE AUTH ---');
  let authStatus = 'UNKNOWN';
  try {
    const userRecord = await auth.getUser(TARGET_UID);
    authStatus = 'AUTH_STILL_EXISTS';
    console.log('Firebase Auth Result: AUTH_STILL_EXISTS');
    console.log('  email:', userRecord.email);
    console.log('  uid:', userRecord.uid);
    console.log('  disabled:', userRecord.disabled);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      authStatus = 'AUTH_DELETED';
      console.log('Firebase Auth Result: AUTH_DELETED');
    } else {
      console.log('Firebase Auth Error:', err.code, err.message);
    }
  }

  // 4. CHECK USER PROFILE
  console.log('\n--- 4. USER PROFILE ---');
  const userSnap = await db.collection('users').doc(TARGET_UID).get();
  console.log(`users/${TARGET_UID} exists:`, userSnap.exists);
  if (userSnap.exists) {
    console.log('User data:', JSON.stringify(userSnap.data(), null, 2));
  }

  const contactsSnap = await db.collection('users').doc(TARGET_UID).collection('contacts').get();
  console.log(`users/${TARGET_UID}/contacts count:`, contactsSnap.size);
  contactsSnap.forEach(d => console.log(' contact:', d.id, JSON.stringify(d.data(), null, 2)));

  const fcmSnap = await db.collection('users').doc(TARGET_UID).collection('fcmTokens').get();
  console.log(`users/${TARGET_UID}/fcmTokens count:`, fcmSnap.size);
  fcmSnap.forEach(d => console.log(' fcmToken:', d.id, JSON.stringify(d.data(), null, 2)));

  // 5. CHECK PHASE 6 GROUPS
  console.log('\n--- 5. PHASE 6 GROUPS ---');
  const g1Id = 'group_p6_created_1786532564667';
  const g2Id = 'group_p6_member_1786532564667';
  
  for (const gId of [g1Id, g2Id]) {
    const gSnap = await db.collection('groups').doc(gId).get();
    console.log(`groups/${gId} exists:`, gSnap.exists);
    if (gSnap.exists) {
      console.log(`groups/${gId} data:`, JSON.stringify(gSnap.data(), null, 2));
      const membersSnap = await db.collection('groups').doc(gId).collection('members').get();
      console.log(`groups/${gId}/members count:`, membersSnap.size);
      membersSnap.forEach(m => console.log(`  member ${m.id}:`, JSON.stringify(m.data(), null, 2)));
    }
  }

  // 6. CHECK RECURRING EXPENSE
  console.log('\n--- 6. RECURRING EXPENSE ---');
  const recId = 'rec_p6_1786532564667';
  let recSnap = await db.collection('recurringExpenses').doc(recId).get();
  if (!recSnap.exists) {
    recSnap = await db.collection('recurring_expenses').doc(recId).get();
  }
  if (!recSnap.exists) {
    // try direct document query across collections
    const collectionsList = ['recurringExpenses', 'recurring_expenses', 'recurring', 'recurring_expense'];
    for (const cName of collectionsList) {
      const s = await db.collection(cName).doc(recId).get();
      if (s.exists) {
        recSnap = s;
        break;
      }
    }
  }
  if (recSnap && recSnap.exists) {
    console.log(`recurring doc ${recSnap.ref.path} exists:`, recSnap.exists);
    console.log('data:', JSON.stringify(recSnap.data(), null, 2));
  } else {
    console.log(`Recurring expense doc ${recId} NOT FOUND in recurring/recurringExpenses/recurring_expenses`);
  }

  // 7. CHECK FINANCIAL RECORDS
  console.log('\n--- 7. FINANCIAL RECORDS ---');
  const exp1Id = 'expense_p6_paid_1786532564667';
  const exp2Id = 'expense_p6_partner_1786532564667';
  const set1Id = 'settlement_p6_1786532564667';

  for (const expId of [exp1Id, exp2Id]) {
    const expSnap = await db.collection('expenses').doc(expId).get();
    console.log(`expenses/${expId} exists:`, expSnap.exists);
    if (expSnap.exists) {
      console.log(`expenses/${expId} data:`, JSON.stringify(expSnap.data(), null, 2));
    }
  }

  const setSnap = await db.collection('settlements').doc(set1Id).get();
  console.log(`settlements/${set1Id} exists:`, setSnap.exists);
  if (setSnap.exists) {
    console.log(`settlements/${set1Id} data:`, JSON.stringify(setSnap.data(), null, 2));
  }

  // 8. CHECK INVERSE CONTACTS
  console.log('\n--- 8. INVERSE CONTACTS ---');
  let partnerUids = new Set();
  const allGroups = await Promise.all([db.collection('groups').doc(g1Id).get(), db.collection('groups').doc(g2Id).get()]);
  allGroups.forEach(g => {
    if (g.exists) {
      const data = g.data();
      if (data.memberIds) data.memberIds.forEach(m => { if (m !== TARGET_UID) partnerUids.add(m); });
      if (data.createdBy && data.createdBy !== TARGET_UID) partnerUids.add(data.createdBy);
    }
  });

  const allExps = await Promise.all([db.collection('expenses').doc(exp1Id).get(), db.collection('expenses').doc(exp2Id).get()]);
  allExps.forEach(e => {
    if (e.exists) {
      const d = e.data();
      if (d.paidBy && d.paidBy !== TARGET_UID) partnerUids.add(d.paidBy);
      if (d.splitDetails) {
        Object.keys(d.splitDetails).forEach(k => { if (k !== TARGET_UID) partnerUids.add(k); });
      }
    }
  });

  if (setSnap.exists) {
    const d = setSnap.data();
    if (d.fromUserId && d.fromUserId !== TARGET_UID) partnerUids.add(d.fromUserId);
    if (d.toUserId && d.toUserId !== TARGET_UID) partnerUids.add(d.toUserId);
  }

  console.log('Discovered Partner UIDs:', Array.from(partnerUids));
  for (const pUid of partnerUids) {
    const invSnap = await db.collection('users').doc(pUid).collection('contacts').doc(TARGET_UID).get();
    console.log(`users/${pUid}/contacts/${TARGET_UID} exists:`, invSnap.exists);
    if (invSnap.exists) {
      console.log('  inverse contact data:', JSON.stringify(invSnap.data(), null, 2));
    }
  }

  // Also search collectionGroup for contacts
  const cgContacts = await db.collectionGroup('contacts').get();
  console.log(`Total contacts across all users in collectionGroup('contacts'): ${cgContacts.size}`);
  cgContacts.forEach(c => {
    if (c.id === TARGET_UID || c.ref.path.includes(TARGET_UID)) {
      console.log('  Found related contact doc:', c.ref.path, JSON.stringify(c.data(), null, 2));
    }
  });

  // 9. CHECK NOTIFICATIONS
  console.log('\n--- 9. NOTIFICATIONS ---');
  const targetNotifsSnap = await db.collection('users').doc(TARGET_UID).collection('notifications').get();
  console.log(`users/${TARGET_UID}/notifications count:`, targetNotifsSnap.size);
  targetNotifsSnap.forEach(n => console.log(' targetNotif:', n.id, JSON.stringify(n.data(), null, 2)));

  // Root or collectionGroup notifications
  const cgNotifs = await db.collectionGroup('notifications').get();
  console.log(`Total notifications in collectionGroup('notifications'): ${cgNotifs.size}`);
  cgNotifs.forEach(n => {
    const d = n.data();
    if (n.ref.path.includes(TARGET_UID) || d.senderId === TARGET_UID || d.fromUserId === TARGET_UID || d.userId === TARGET_UID || d.targetUid === TARGET_UID) {
      console.log('  Found related notification:', n.ref.path, JSON.stringify(d, null, 2));
    }
  });

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

runInvestigation().catch(console.error);
