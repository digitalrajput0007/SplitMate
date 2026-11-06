import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, GroupData, GroupMemberDetail, UserGroupSummary } from './firestoreService';

/**
 * Migration Service for SplitMate
 * Safely migrates existing legacy flat Firestore structure to a high-performance denormalized schema.
 * 
 * Performance Enhancements:
 * 1. Denormalizes membersDetails inside groups/{groupId}
 * 2. Denormalizes groupsSummary inside users/{uid} for 1-query Dashboard loads
 * 3. Migrates legacy top-level expenses to groups/{groupId}/expenses subcollection
 */
export async function migrateFirestoreSchema(): Promise<{
  groupsMigrated: number;
  usersMigrated: number;
  expensesMigrated: number;
}> {
  console.log('[Migration] Starting Firestore schema denormalization...');
  let groupsCount = 0;
  let usersCount = 0;
  let expensesCount = 0;

  try {
    // 1. Fetch all users for lookup map
    const usersSnap = await getDocs(collection(db, 'users'));
    const userProfilesMap = new Map<string, UserProfile>();
    usersSnap.forEach((userDoc) => {
      userProfilesMap.set(userDoc.id, { uid: userDoc.id, ...userDoc.data() } as UserProfile);
    });

    // Track groups summary for each user
    const userGroupsSummaryMap = new Map<string, UserGroupSummary[]>();

    // 2. Process all groups
    const groupsSnap = await getDocs(collection(db, 'groups'));
    const batch = writeBatch(db);

    for (const groupDoc of groupsSnap.docs) {
      const groupData = groupDoc.data() as GroupData;
      const groupId = groupDoc.id;
      const memberIds = groupData.memberIds || [];

      // Build embedded membersDetails
      const membersDetails: GroupMemberDetail[] = memberIds.map((uid) => {
        const profile = userProfilesMap.get(uid);
        return {
          uid,
          name: profile?.name || 'Member',
          email: profile?.email || '',
          photoUrl: profile?.photoUrl || undefined,
          photoThumbnailUrl: profile?.photoThumbnailUrl || undefined,
          role: uid === groupData.createdBy ? 'Admin' : 'Member',
          joinedAt: groupData.membersJoinedAt?.[uid] || Date.now(),
        };
      });

      // Update Group Document with embedded membersDetails
      const groupRef = doc(db, 'groups', groupId);
      batch.update(groupRef, { membersDetails });
      groupsCount++;

      // Populate user group summaries for each member
      memberIds.forEach((uid) => {
        if (!userGroupsSummaryMap.has(uid)) {
          userGroupsSummaryMap.set(uid, []);
        }
        const userSummaries = userGroupsSummaryMap.get(uid)!;
        userSummaries.push({
          groupId,
          name: groupData.name,
          photoUrl: groupData.photoUrl,
          photoThumbnailUrl: groupData.photoThumbnailUrl,
          groupType: groupData.groupType,
          role: uid === groupData.createdBy ? 'Admin' : 'Member',
          updatedAt: groupData.createdAt || Date.now(),
        });
      });

      // 3. Migrate top-level expenses to subcollection groups/{groupId}/expenses
      const legacyExpensesQuery = query(collection(db, 'expenses'), where('groupId', '==', groupId));
      const legacyExpensesSnap = await getDocs(legacyExpensesQuery);

      for (const expDoc of legacyExpensesSnap.docs) {
        const expData = expDoc.data();
        const subcollExpenseRef = doc(db, 'groups', groupId, 'expenses', expDoc.id);

        const payerProfile = userProfilesMap.get(expData.paidBy);
        batch.set(subcollExpenseRef, {
          ...expData,
          expenseId: expDoc.id,
          paidByName: expData.paidByName || payerProfile?.name || 'Member',
          paidByPhotoUrl: payerProfile?.photoThumbnailUrl || payerProfile?.photoUrl || null,
        }, { merge: true });

        expensesCount++;
      }
    }

    // 4. Update users with groupsSummary
    for (const [uid, summaries] of userGroupsSummaryMap.entries()) {
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, { groupsSummary: summaries });
      usersCount++;
    }

    // Commit batch migration
    await batch.commit();
    console.log(`[Migration] Completed successfully! Groups: ${groupsCount}, Users: ${usersCount}, Expenses: ${expensesCount}`);
    return { groupsMigrated: groupsCount, usersMigrated: usersCount, expensesMigrated: expensesCount };
  } catch (error) {
    console.error('[Migration] Failed to migrate Firestore schema:', error);
    throw error;
  }
}
