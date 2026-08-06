import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { getCurrencyConfig, formatCurrency } from './currencyService';
export { formatCurrency };
import { db, auth } from '../config/firebase';

export interface PaymentMethod {
  id: string;
  handle: string;
  type: 'UPI' | 'Bank' | 'Other';
  label: string;
  isDefault: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  paymentHandle?: string;
  paymentMethods?: PaymentMethod[];
  dob?: string;
  mobile?: string;
  emailVerified?: boolean;
  preferences?: {
    groupInvites?: boolean;
    expenseAlerts?: boolean;
    settlementReminders?: boolean;
    monthlyDigest?: boolean;
    theme?: string;
    language?: string;
  };
  createdAt?: any;
}

export interface GroupMemberDetail {
  uid: string;
  name: string;
  email?: string;
  photoUrl?: string;
  role?: 'Admin' | 'Member';
  joinedAt?: number;
  includeExistingExpenses?: boolean;
}

export interface GroupInvitation {
  invitationId?: string;
  groupId: string;
  groupName: string;
  fromUserId?: string;
  toUserId?: string;
  invitedUid?: string;
  invitedByName: string;
  includeExistingExpenses: boolean;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: any;
}

export interface GroupData {
  groupId: string;
  name: string;
  category?: 'Travel' | 'Food' | 'Rent' | 'Event' | 'Utilities' | 'Other';
  groupType?: 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Home' | 'Other';
  enableDates?: boolean;
  startDate?: string;
  endDate?: string;
  memberIds: string[];
  members?: Array<{ name: string; email?: string }>;
  memberProfiles?: Record<string, GroupMemberDetail>;
  membersJoinedAt?: Record<string, number>;
  memberExistingExpensesPreference?: Record<string, boolean>;
  photoUrl?: string;
  createdBy: string;
  createdAt: any;
  isArchived?: boolean;
  balanceLabel?: 'owed' | 'owe' | 'settled';
  balanceAmount?: string;
}

export interface ExpenseData {
  expenseId?: string;
  groupId: string;
  groupName?: string;
  title: string;
  amount: number;
  paidBy: string;
  paidByName?: string;
  createdBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splitDetails: Record<string, number>;
  category: string;
  date?: string;
  notes?: string;
  receiptUrl?: string;
  createdAt?: any;
}

export interface SettlementData {
  settlementId?: string;
  groupId: string;
  groupName?: string;
  fromUserId: string;
  fromName?: string;
  toUserId: string;
  toName?: string;
  amount: number;
  status: 'completed' | 'pending';
  createdAt?: any;
}

export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  title: string;
  subtitle: string;
  amount: number;
  category?: string;
  groupName?: string;
  date: string;
  rawTimestamp: number;
}

// -------------------------------------------------------------
// USERS COLLECTION
// -------------------------------------------------------------
export const saveUserProfileToFirestore = async (profile: Partial<UserProfile> & { uid: string }) => {
  try {
    const userRef = doc(db, 'users', profile.uid);
    const existingSnap = await getDoc(userRef);

    const dataToSave: Record<string, any> = {
      uid: profile.uid,
      updatedAt: serverTimestamp(),
    };

    if (profile.name !== undefined) dataToSave.name = profile.name;
    if (profile.email !== undefined) dataToSave.email = profile.email;

    // Safety: Never allow local URIs to be saved to Firestore users collection
    if (profile.photoUrl !== undefined) {
      if (profile.photoUrl.startsWith('file://') || profile.photoUrl.startsWith('content://')) {
        console.warn('Attempted to save local URI to users collection. Blocking photo update.');
      } else {
        dataToSave.photoUrl = profile.photoUrl;
      }
    }

    if (profile.paymentHandle !== undefined) dataToSave.paymentHandle = profile.paymentHandle;
    if (profile.paymentMethods !== undefined) dataToSave.paymentMethods = profile.paymentMethods;
    if (profile.dob !== undefined) dataToSave.dob = profile.dob;
    if (profile.mobile !== undefined) dataToSave.mobile = profile.mobile;
    if (profile.emailVerified !== undefined) dataToSave.emailVerified = profile.emailVerified;

    if (!existingSnap.exists()) {
      dataToSave.createdAt = serverTimestamp();
      // Only set defaults for new profiles
      if (dataToSave.name === undefined) dataToSave.name = profile.email?.split('@')[0] || 'User';
      if (dataToSave.paymentHandle === undefined) dataToSave.paymentHandle = '';
    }

    await setDoc(userRef, dataToSave, { merge: true });
    return dataToSave;
  } catch (error: any) {
    if (error?.code !== 'unavailable' && !error?.message?.includes('offline')) {
      console.log('Firestore Profile Sync Notice:', error?.message || error);
    }
    return null;
  }
};

export const setUserEmailVerifiedInFirestore = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { emailVerified: true, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error setting emailVerified in Firestore:', error);
  }
};

export const getUserProfileFromFirestore = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    // Add 2.5s timeout so network latency or offline Firestore doesn't hang login UI
    const fetchPromise = getDoc(userRef).then((snap) => (snap.exists() ? (snap.data() as UserProfile) : null));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    if (error?.code !== 'unavailable' && !error?.message?.includes('offline')) {
      console.log('Firestore Profile Fetch Notice:', error?.message || error);
    }
    return null;
  }
};

export const isMobileNumberRegistered = async (mobileNumber: string, currentUid?: string): Promise<boolean> => {
  try {
    const rawDigits = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    if (!rawDigits || rawDigits.length < 10) return false;

    const querySnap = await getDocs(collection(db, 'users'));
    for (const docSnap of querySnap.docs) {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (data.uid !== currentUid && data.mobile) {
          const userRawDigits = data.mobile.replace(/[^0-9]/g, '').slice(-10);
          if (userRawDigits === rawDigits) {
            return true;
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking duplicate mobile number:', error);
    return false;
  }
};

export const getAllUsersFromFirestore = async (): Promise<UserProfile[]> => {
  try {
    const querySnap = await getDocs(collection(db, 'users'));
    const users: UserProfile[] = [];
    querySnap.forEach((docSnap) => {
      if (docSnap.exists()) {
        users.push(docSnap.data() as UserProfile);
      }
    });
    return users;
  } catch (error: any) {
    console.log('Error fetching all users from Firestore:', error);
    return [];
  }
};

export const subscribeAllUserProfiles = (onUpdate: (users: UserProfile[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snap) => {
    const users = snap.docs.map(d => d.data() as UserProfile);
    onUpdate(users);
  });
};

export const addContactToUserFirestore = async (currentUid: string, contactUid: string): Promise<void> => {
  try {
    const userContactRef = doc(db, 'users', currentUid, 'user_contacts', contactUid);
    await setDoc(userContactRef, {
      contactUid,
      addedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding user contact:', error);
  }
};

export const removeContactFromUserFirestore = async (currentUid: string, contactUid: string): Promise<void> => {
  try {
    const userContactRef = doc(db, 'users', currentUid, 'user_contacts', contactUid);
    await deleteDoc(userContactRef);
  } catch (error) {
    console.error('Error removing user contact:', error);
    throw error;
  }
};

export const getSavedUserContactsFromFirestore = async (currentUid: string): Promise<UserProfile[]> => {
  try {
    const contactsSnap = await getDocs(collection(db, 'users', currentUid, 'user_contacts'));
    const contactIds = contactsSnap.docs.map((d) => d.id);

    if (contactIds.length === 0) return [];

    const allUsers = await getAllUsersFromFirestore();
    return allUsers.filter((u) => contactIds.includes(u.uid));
  } catch (error) {
    console.error('Error fetching saved contacts:', error);
    return [];
  }
};

export const updateUserPreferencesInFirestore = async (
  uid: string,
  preferences: Partial<NonNullable<UserProfile['preferences']>>
) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { preferences, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
};

// -------------------------------------------------------------
// GROUPS COLLECTION
// -------------------------------------------------------------
export const createGroupInFirestore = async (
  name: string,
  memberIds: string[],
  extraDetails?: {
    groupType?: 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Other';
    photoUrl?: string;
    familyName?: string;
    setupMonthlySplit?: boolean;
    enableDates?: boolean;
    startDate?: string;
    endDate?: string;
  }
): Promise<string> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const now = Date.now();
    const joinedAtMap: Record<string, number> = {};
    const existingExpensesPrefMap: Record<string, boolean> = {};

    // Creator joins immediately as accepted
    joinedAtMap[currentUser.uid] = now;
    existingExpensesPrefMap[currentUser.uid] = true;

    // Filter invited members excluding creator
    const invitedMemberIds = Array.from(new Set(memberIds.filter((id) => id !== currentUser.uid)));
    const allMemberIds = [currentUser.uid, ...invitedMemberIds];

    const groupRef = doc(collection(db, 'groups'));
    const groupData: GroupData = {
      groupId: groupRef.id,
      name: name.trim(),
      memberIds: allMemberIds,
      membersJoinedAt: joinedAtMap,
      memberExistingExpensesPreference: existingExpensesPrefMap,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      ...(extraDetails?.groupType && { groupType: extraDetails.groupType }),
      ...(extraDetails?.photoUrl && { photoUrl: extraDetails.photoUrl }),
      ...(extraDetails?.familyName && { familyName: extraDetails.familyName }),
      ...(extraDetails?.setupMonthlySplit !== undefined && { setupMonthlySplit: extraDetails.setupMonthlySplit }),
      ...(extraDetails?.enableDates !== undefined && { enableDates: extraDetails.enableDates }),
      ...(extraDetails?.startDate && { startDate: extraDetails.startDate }),
      ...(extraDetails?.endDate && { endDate: extraDetails.endDate }),
    };

    await setDoc(groupRef, groupData);

    // Create pending invitations in groupInvitations collection for each invited user
    console.log(`[Firestore] About to process ${invitedMemberIds.length} pending invitations...`);
    for (const invitedUid of invitedMemberIds) {
      console.log(`[Firestore] About to write invitation for user: ${invitedUid}`);
      try {
        const invRef = doc(collection(db, 'groupInvitations'));
        const invData = {
          invitationId: invRef.id,
          groupId: groupRef.id,
          groupName: name.trim(),
          fromUserId: currentUser.uid,
          toUserId: invitedUid,
          invitedByName: currentUser.displayName || 'Group Admin',
          includeExistingExpenses: true,
          status: 'pending',
          createdAt: serverTimestamp(),
        };
        await setDoc(invRef, invData);
        console.log(`✓ INVITATION WRITTEN SUCCESSFULLY for user ${invitedUid} (invId: ${invRef.id})`);
      } catch (invErr: any) {
        console.error(`✗ INVITATION WRITE FAILED for user ${invitedUid}:`, invErr?.code || 'unknown', invErr?.message || invErr);
      }
    }

    return groupRef.id;
  } catch (error) {
    console.error('Error creating group in Firestore:', error);
    throw error;
  }
};

export const inviteMemberToGroup = async (
  groupId: string,
  newMemberUid: string,
  includeExistingExpenses: boolean
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const groupData = snap.data() as GroupData;
    const currentMemberIds = groupData.memberIds || [];
    if (!currentMemberIds.includes(newMemberUid)) {
      currentMemberIds.push(newMemberUid);
      await updateDoc(groupRef, {
        memberIds: currentMemberIds,
        updatedAt: serverTimestamp(),
      });
    }

    // Issue a pending invitation for the new user
    console.log(`[Firestore] About to write invitation for user: ${newMemberUid}`);
    try {
      const invRef = doc(collection(db, 'groupInvitations'));
      const invData = {
        invitationId: invRef.id,
        groupId,
        groupName: groupData.name || 'Group',
        fromUserId: currentUser.uid,
        toUserId: newMemberUid,
        invitedByName: currentUser.displayName || 'Group Admin',
        includeExistingExpenses,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      await setDoc(invRef, invData);
      console.log(`✓ INVITATION WRITTEN SUCCESSFULLY for user ${newMemberUid} (invId: ${invRef.id})`);
    } catch (invErr: any) {
      console.error(`✗ INVITATION WRITE FAILED for user ${newMemberUid}:`, invErr?.code || 'unknown', invErr?.message || invErr);
    }
  } catch (error) {
    console.error('Error inviting member to group:', error);
    throw error;
  }
};

export const updateGroupInFirestore = async (groupId: string, data: Partial<GroupData>) => {
  try {
    const groupRef = doc(db, 'groups', groupId);

    // Safety: Never allow local URIs to be saved to Firestore
    if (data.photoUrl && (data.photoUrl.startsWith('file://') || data.photoUrl.startsWith('content://'))) {
      console.warn('Attempted to save local URI to Firestore. Blocking photo update.');
      delete data.photoUrl;
    }

    await setDoc(groupRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
};

export const deleteGroupFromFirestore = async (groupId: string) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await deleteDoc(groupRef);
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

export const addMemberToGroupWithPreference = async (
  groupId: string,
  newMemberUid: string,
  includeExistingExpenses: boolean
) => {
  return inviteMemberToGroup(groupId, newMemberUid, includeExistingExpenses);
};

export const acceptGroupInvitation = async (invitationId: string, groupId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const invRef = doc(db, 'groupInvitations', invitationId);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error('Invitation not found');

    const invData = invSnap.data() as GroupInvitation;

    // Update invitation status to accepted
    await updateDoc(invRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    // Update group membersJoinedAt and memberExistingExpensesPreference
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data() as GroupData;
      const membersJoinedAt = gData.membersJoinedAt || {};
      membersJoinedAt[currentUser.uid] = Date.now();

      const memberExistingExpensesPreference = gData.memberExistingExpensesPreference || {};
      memberExistingExpensesPreference[currentUser.uid] = invData.includeExistingExpenses !== false;

      await updateDoc(groupRef, {
        membersJoinedAt,
        memberExistingExpensesPreference,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error accepting group invitation:', error);
    throw error;
  }
};

export const declineGroupInvitation = async (invitationId: string, groupId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const invRef = doc(db, 'groupInvitations', invitationId);
    await updateDoc(invRef, {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });

    // Remove user from group memberIds
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data() as GroupData;
      const updatedMemberIds = (gData.memberIds || []).filter((id) => id !== currentUser.uid);
      await updateDoc(groupRef, {
        memberIds: updatedMemberIds,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error declining group invitation:', error);
    throw error;
  }
};

export const cancelGroupInvitation = async (groupId: string, toUserId: string) => {
  try {
    // 1. Find and delete the pending invitation
    const invQuery = query(
      collection(db, 'groupInvitations'),
      where('groupId', '==', groupId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const invSnap = await getDocs(invQuery);
    for (const docSnap of invSnap.docs) {
      await deleteDoc(docSnap.ref);
    }

    // 2. Remove user from group memberIds
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data() as GroupData;
      const updatedMemberIds = (gData.memberIds || []).filter((id) => id !== toUserId);
      await updateDoc(groupRef, {
        memberIds: updatedMemberIds,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error cancelling group invitation:', error);
    throw error;
  }
};

export const subscribeToPendingInvitations = (
  uid: string,
  onInvitationsUpdate: (invitations: GroupInvitation[]) => void
) => {
  console.log(`[Firestore] Listening for pending invitations for user UID: "${uid}"...`);

  // Query all invitations for this target user (filtering pending client-side to prevent composite index requirement issues)
  const q = query(
    collection(db, 'groupInvitations'),
    where('toUserId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      console.log(`[Firestore] Pending invitations snapshot fired. Docs count: ${snapshot.docs.length}`);
      const invitations: GroupInvitation[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as GroupInvitation;
        console.log(`[Firestore] Invitation doc ${docSnap.id}: status="${data.status}", group="${data.groupName}", from="${data.fromUserId}"`);
        if (!data.status || data.status === 'pending') {
          invitations.push({
            invitationId: docSnap.id,
            ...data,
          });
        }
      });
      console.log(`[Firestore] Total pending invitations passed to UI: ${invitations.length}`);
      onInvitationsUpdate(invitations);
    },
    (error) => {
      console.error('Error listening to pending invitations:', error);
    }
  );
};

export const subscribeToUserGroups = (
  uid: string,
  onGroupsUpdate: (groups: GroupData[]) => void
) => {
  // Query all groups where memberIds contains uid
  const groupsQuery = query(
    collection(db, 'groups'),
    where('memberIds', 'array-contains', uid)
  );

  // Also query accepted invitations to filter groups list
  const invitationsQuery = query(
    collection(db, 'groupInvitations'),
    where('toUserId', '==', uid)
  );

  return onSnapshot(
    groupsQuery,
    async (snapshot) => {
      const invSnap = await getDocs(invitationsQuery);
      const invitationMap = new Map<string, string>(); // groupId -> status
      invSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        invitationMap.set(data.groupId, data.status);
      });

      const groups: GroupData[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as GroupData;
        const gId = docSnap.id;

        // Creator always sees group. Invited users only see group if invitation status is 'accepted'
        const isCreator = data.createdBy === uid;
        const invStatus = invitationMap.get(gId);
        const isAccepted = invStatus === 'accepted';

        if (isCreator || isAccepted) {
          groups.push({
            balanceLabel: 'settled',
            balanceAmount: formatCurrency(0),
            ...data,
            groupId: gId,
          });
        }
      });

      onGroupsUpdate(groups);
    },
    (error) => {
      console.error('Error listening to groups:', error);
    }
  );
};

export const subscribeToAcceptedMembers = (
  groupId: string,
  onUpdate: (members: UserProfile[], pending: UserProfile[]) => void
) => {
  const groupRef = doc(db, 'groups', groupId);
  const usersQuery = query(collection(db, 'users'));
  const invQuery = query(collection(db, 'groupInvitations'), where('groupId', '==', groupId));

  let currentGroup: GroupData | null = null;
  let allUsers: UserProfile[] = [];
  let allInvitations: any[] = [];

  const mergeAndNotify = () => {
    if (!currentGroup) return;

    const memberIds = currentGroup.memberIds || [];
    const createdBy = currentGroup.createdBy;
    const userMap = new Map<string, UserProfile>();
    allUsers.forEach((u) => userMap.set(u.uid, u));

    const invMap = new Map<string, string>(); // toUserId -> status
    allInvitations.forEach((d) => {
      invMap.set(d.toUserId, d.status);
    });

    const accepted: UserProfile[] = [];
    const pending: UserProfile[] = [];

    memberIds.forEach((uid) => {
      const user = userMap.get(uid);
      if (!user) return;

      if (uid === createdBy) {
        accepted.push(user);
      } else {
        const status = invMap.get(uid);
        if (status === 'accepted') {
          accepted.push(user);
        } else if (!status || status === 'pending') {
          pending.push(user);
        }
      }
    });

    onUpdate(accepted, pending);
  };

  const unsub1 = onSnapshot(groupRef, (snap) => {
    if (snap.exists()) {
      currentGroup = snap.data() as GroupData;
      mergeAndNotify();
    }
  });

  const unsub2 = onSnapshot(usersQuery, (snap) => {
    allUsers = snap.docs.map(d => d.data() as UserProfile);
    mergeAndNotify();
  });

  const unsub3 = onSnapshot(invQuery, (snap) => {
    allInvitations = snap.docs.map(d => d.data());
    mergeAndNotify();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
};

export const subscribeToGroupDetail = (
  groupId: string,
  onGroupUpdate: (group: GroupData | null) => void
) => {
  const groupRef = doc(db, 'groups', groupId);
  return onSnapshot(groupRef, (snap) => {
    if (snap.exists()) {
      onGroupUpdate({ groupId: snap.id, ...snap.data() } as GroupData);
    } else {
      onGroupUpdate(null);
    }
  });
};

export interface ExpenseComment {
  commentId: string;
  expenseId: string;
  uid: string;
  userName: string;
  text: string;
  createdAt: any;
}

// -------------------------------------------------------------
// EXPENSES COLLECTION
// -------------------------------------------------------------
export const addExpenseToFirestore = async (expense: Omit<ExpenseData, 'expenseId' | 'createdAt'>): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const expenseRef = doc(collection(db, 'expenses'));
    const expenseData = {
      ...expense,
      expenseId: expenseRef.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };
    await setDoc(expenseRef, expenseData);
    return expenseRef.id;
  } catch (error) {
    console.error('Error adding expense to Firestore:', error);
    throw error;
  }
};

export const updateExpenseInFirestore = async (expenseId: string, data: Partial<ExpenseData>) => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await setDoc(expenseRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

export const deleteExpenseFromFirestore = async (expenseId: string) => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};

export const subscribeToExpenseDetail = (
  expenseId: string,
  onUpdate: (expense: ExpenseData | null) => void
) => {
  const expenseRef = doc(db, 'expenses', expenseId);
  return onSnapshot(expenseRef, (snap) => {
    if (snap.exists()) {
      onUpdate({ expenseId: snap.id, ...snap.data() } as ExpenseData);
    } else {
      onUpdate(null);
    }
  });
};

export const addCommentToExpense = async (expenseId: string, text: string) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const commentRef = doc(collection(db, 'expenses', expenseId, 'comments'));
    const commentData = {
      commentId: commentRef.id,
      expenseId,
      uid: user.uid,
      userName: user.displayName || 'Member',
      text: text.trim(),
      createdAt: serverTimestamp(),
    };
    await setDoc(commentRef, commentData);
    return true;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

export const subscribeToExpenseComments = (
  expenseId: string,
  onUpdate: (comments: ExpenseComment[]) => void
) => {
  const q = query(
    collection(db, 'expenses', expenseId, 'comments'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map(d => d.data() as ExpenseComment);
    onUpdate(comments);
  });
};

export const subscribeToGroupExpenses = (
  groupId: string,
  onExpensesUpdate: (expenses: ExpenseData[]) => void
) => {
  const q = query(
    collection(db, 'expenses'),
    where('groupId', '==', groupId)
  );

  return onSnapshot(q, (snap) => {
    const expenses: ExpenseData[] = snap.docs.map((d) => d.data() as ExpenseData);
    expenses.sort((a, b) => {
      const timeA = a.createdAt?.seconds || Date.now();
      const timeB = b.createdAt?.seconds || Date.now();
      return timeB - timeA;
    });
    onExpensesUpdate(expenses);
  });
};

// -------------------------------------------------------------
// SETTLEMENTS COLLECTION
// -------------------------------------------------------------
export const addSettlementToFirestore = async (settlement: Omit<SettlementData, 'settlementId' | 'createdAt'>): Promise<string> => {
  try {
    const settlementRef = doc(collection(db, 'settlements'));
    const settlementData = {
      ...settlement,
      settlementId: settlementRef.id,
      createdAt: serverTimestamp(),
    };
    await setDoc(settlementRef, settlementData);
    return settlementRef.id;
  } catch (error) {
    console.error('Error adding settlement to Firestore:', error);
    throw error;
  }
};

export const subscribeToGroupSettlements = (
  groupId: string,
  onSettlementsUpdate: (settlements: SettlementData[]) => void
) => {
  const q = query(
    collection(db, 'settlements'),
    where('groupId', '==', groupId)
  );

  return onSnapshot(q, (snap) => {
    const settlements: SettlementData[] = snap.docs.map((d) => d.data() as SettlementData);
    onSettlementsUpdate(settlements);
  });
};

export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'group' | 'reminder';
  title: string;
  subtitle: string;
  amount: number;
  category?: string;
  groupName?: string;
  date: string;
  rawTimestamp: number;
  actorUid: string;
  targetUid?: string;
}

export interface AppNotification {
  notificationId: string;
  recipientUid: string;
  senderUid: string;
  groupId: string;
  groupName: string;
  expenseId?: string;
  type: 'payment_reminder' | 'group_invitation' | 'general';
  title: string;
  message: string;
  read: boolean;
  amount?: number;
  createdAt: any;
}

// -------------------------------------------------------------
// ACTIVITY FEED
// -------------------------------------------------------------
export const subscribeUserActivityFeed = (
  groupIds: string[],
  onActivityUpdate: (activities: ActivityItem[]) => void
) => {
  if (!groupIds || groupIds.length === 0) {
    onActivityUpdate([]);
    return () => {};
  }

  const expensesQuery = query(collection(db, 'expenses'));
  const settlementsQuery = query(collection(db, 'settlements'));
  const groupsQuery = query(collection(db, 'groups'));
  const notificationsQuery = query(collection(db, 'notifications'), where('type', '==', 'payment_reminder'));

  let currentExpenses: ExpenseData[] = [];
  let currentSettlements: SettlementData[] = [];
  let currentGroups: GroupData[] = [];
  let currentReminders: AppNotification[] = [];

  const mergeAndNotify = () => {
    const items: ActivityItem[] = [];

    currentExpenses.forEach((exp) => {
      if (groupIds.includes(exp.groupId)) {
        const rawTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();
        items.push({
          id: exp.expenseId || Math.random().toString(),
          type: 'expense',
          title: exp.title,
          subtitle: `Added in ${exp.groupName || 'Group'}`,
          amount: exp.amount,
          category: exp.category,
          groupName: exp.groupName,
          date: new Date(rawTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawTimestamp: rawTime,
          actorUid: exp.paidBy,
        });
      }
    });

    currentSettlements.forEach((set) => {
      if (groupIds.includes(set.groupId)) {
        const rawTime = set.createdAt?.seconds ? set.createdAt.seconds * 1000 : Date.now();
        items.push({
          id: set.settlementId || Math.random().toString(),
          type: 'settlement',
          title: `Settlement Recorded`,
          subtitle: `Recorded in ${set.groupName || 'Group'}`,
          amount: set.amount,
          category: '💸',
          date: new Date(rawTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawTimestamp: rawTime,
          actorUid: set.fromUserId,
        });
      }
    });

    currentGroups.forEach((g) => {
      if (groupIds.includes(g.groupId)) {
        const rawTime = g.createdAt?.seconds ? g.createdAt.seconds * 1000 : Date.now();
        items.push({
          id: g.groupId,
          type: 'group',
          title: `${g.name} created`,
          subtitle: `New group started!`,
          amount: 0,
          category: '👥',
          date: new Date(rawTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawTimestamp: rawTime,
          actorUid: g.createdBy,
        });
      }
    });

    currentReminders.forEach((rem) => {
      if (groupIds.includes(rem.groupId)) {
        const rawTime = rem.createdAt?.seconds ? rem.createdAt.seconds * 1000 : Date.now();
        items.push({
          id: rem.notificationId,
          type: 'reminder',
          title: `Payment Reminder`,
          subtitle: `Sent in ${rem.groupName}`,
          amount: rem.amount || 0,
          category: '🔔',
          groupName: rem.groupName,
          date: new Date(rawTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawTimestamp: rawTime,
          actorUid: rem.senderUid,
          targetUid: rem.recipientUid,
        });
      }
    });

    items.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
    onActivityUpdate(items);
  };

  const unsub1 = onSnapshot(expensesQuery, (snap) => {
    currentExpenses = snap.docs.map((d) => d.data() as ExpenseData);
    mergeAndNotify();
  });

  const unsub2 = onSnapshot(settlementsQuery, (snap) => {
    currentSettlements = snap.docs.map((d) => d.data() as SettlementData);
    mergeAndNotify();
  });

  const unsub3 = onSnapshot(groupsQuery, (snap) => {
    currentGroups = snap.docs.map((d) => ({ ...d.data(), groupId: d.id } as GroupData));
    mergeAndNotify();
  });

  const unsub4 = onSnapshot(notificationsQuery, (snap) => {
    currentReminders = snap.docs.map((d) => d.data() as AppNotification);
    mergeAndNotify();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
};

export const subscribeUserGroupBalances = (
  uid: string,
  onBalancesUpdate: (balances: Record<string, number>) => void
) => {
  if (!uid) {
    onBalancesUpdate({});
    return () => {};
  }

  const expensesQuery = query(collection(db, 'expenses'));
  const settlementsQuery = query(collection(db, 'settlements'));

  let allExpenses: ExpenseData[] = [];
  let allSettlements: SettlementData[] = [];

  const recalculate = async () => {
    const groupBalances: Record<string, number> = {};

    // Fetch user groups for preferences
    const userGroupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const userGroupsMap = new Map<string, GroupData>();
    userGroupsSnap.docs.forEach((docSnap) => {
      userGroupsMap.set(docSnap.id, docSnap.data() as GroupData);
    });

    allExpenses.forEach((exp) => {
      const gId = exp.groupId;
      if (!userGroupsMap.has(gId)) return;

      const groupData = userGroupsMap.get(gId);
      const joinedAt = groupData?.membersJoinedAt?.[uid];
      const includeExisting = groupData?.memberExistingExpensesPreference?.[uid] ?? true;
      const expTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();

      if (!includeExisting && joinedAt && expTime < joinedAt) return;

      const splitDetails = exp.splitDetails || {};
      const isPayer = exp.paidBy === uid;
      const userShare = splitDetails[uid] || 0;

      if (!(gId in groupBalances)) groupBalances[gId] = 0;

      if (isPayer) {
        groupBalances[gId] += (exp.amount - userShare);
      } else if (userShare > 0) {
        groupBalances[gId] -= userShare;
      }
    });

    allSettlements.forEach((s) => {
      const gId = s.groupId;
      if (!userGroupsMap.has(gId)) return;
      if (s.status === 'completed' || !s.status) {
        if (!(gId in groupBalances)) groupBalances[gId] = 0;
        if (s.fromUserId === uid) {
          groupBalances[gId] += s.amount;
        } else if (s.toUserId === uid) {
          groupBalances[gId] -= s.amount;
        }
      }
    });

    // Round values
    Object.keys(groupBalances).forEach(gId => {
      groupBalances[gId] = Math.round(groupBalances[gId] * 100) / 100;
    });

    onBalancesUpdate(groupBalances);
  };

  const unsub1 = onSnapshot(expensesQuery, (snap) => {
    allExpenses = snap.docs.map((d) => d.data() as ExpenseData);
    recalculate();
  });

  const unsub2 = onSnapshot(settlementsQuery, (snap) => {
    allSettlements = snap.docs.map((d) => d.data() as SettlementData);
    recalculate();
  });

  return () => {
    unsub1();
    unsub2();
  };
};

// -------------------------------------------------------------
// USER BALANCE SUMMARY SUBSCRIBER
// -------------------------------------------------------------
export interface UserBalanceSummary {
  totalBalance: number;
  youAreOwed: number;
  youOwe: number;
}

export const subscribeUserBalanceSummary = (
  uid: string,
  onSummaryUpdate: (summary: UserBalanceSummary) => void
) => {
  if (!uid) {
    onSummaryUpdate({ totalBalance: 0, youAreOwed: 0, youOwe: 0 });
    return () => {};
  }

  const expensesQuery = query(collection(db, 'expenses'));
  const settlementsQuery = query(collection(db, 'settlements'));

  let allExpenses: ExpenseData[] = [];
  let allSettlements: SettlementData[] = [];

  const recalculateBalances = async () => {
    let owedSum = 0;
    let oweSum = 0;

    // Fetch user groups to retrieve joinedAt timestamps and includeExistingExpenses preferences
    const userGroupsSnap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
    const userGroupsMap = new Map<string, GroupData>();
    userGroupsSnap.docs.forEach((docSnap) => {
      userGroupsMap.set(docSnap.id, docSnap.data() as GroupData);
    });

    allExpenses.forEach((exp) => {
      const groupData = userGroupsMap.get(exp.groupId);
      const joinedAt = groupData?.membersJoinedAt?.[uid];
      const includeExisting = groupData?.memberExistingExpensesPreference?.[uid] ?? true;

      const expTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();

      // If user chose "new only" (includeExisting = false), skip expenses created before they joined
      if (!includeExisting && joinedAt && expTime < joinedAt) {
        return;
      }

      const splitDetails = exp.splitDetails || {};
      const isPayer = exp.paidBy === uid;
      const userShare = splitDetails[uid] || 0;

      if (isPayer) {
        // Amount others owe me for this expense
        const othersShare = exp.amount - userShare;
        if (othersShare > 0) {
          owedSum += othersShare;
        }
      } else if (userShare > 0) {
        // Amount I owe the payer for this expense
        oweSum += userShare;
      }
    });

    allSettlements.forEach((settlement) => {
      if (settlement.status === 'completed' || !settlement.status) {
        if (settlement.fromUserId === uid) {
          // I paid off a debt
          oweSum = Math.max(0, oweSum - settlement.amount);
        } else if (settlement.toUserId === uid) {
          // Someone paid me
          owedSum = Math.max(0, owedSum - settlement.amount);
        }
      }
    });

    const netBalance = Math.round((owedSum - oweSum) * 100) / 100;

    onSummaryUpdate({
      totalBalance: netBalance,
      youAreOwed: Math.round(owedSum * 100) / 100,
      youOwe: Math.round(oweSum * 100) / 100,
    });
  };

  const unsub1 = onSnapshot(expensesQuery, (snap) => {
    allExpenses = snap.docs.map((d) => d.data() as ExpenseData);
    recalculateBalances();
  });

  const unsub2 = onSnapshot(settlementsQuery, (snap) => {
    allSettlements = snap.docs.map((d) => d.data() as SettlementData);
    recalculateBalances();
  });

  return () => {
    unsub1();
    unsub2();
  };
};

// -------------------------------------------------------------
// USER PENDING SETTLEMENTS SUBSCRIBER
// -------------------------------------------------------------
export const subscribeToUserPendingSettlements = (
  uid: string,
  onUpdate: (settlements: SettlementData[]) => void
) => {
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  // Find settlements where user is either 'from' or 'to' and status is 'pending'
  const q = query(
    collection(db, 'settlements'),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snap) => {
    const allPending = snap.docs.map((d) => ({ ...d.data(), settlementId: d.id } as SettlementData));
    const userPending = allPending.filter(s => s.fromUserId === uid || s.toUserId === uid);
    onUpdate(userPending);
  });
};

// -------------------------------------------------------------
// USER MONTHLY INSIGHTS SUBSCRIBER
// -------------------------------------------------------------
export interface MonthlyInsights {
  totalPaid: number;
  totalReceived: number;
  largestExpense: { title: string; amount: number };
  activeGroupsCount: number;
}

export const subscribeUserMonthlyInsights = (
  uid: string,
  onUpdate: (insights: MonthlyInsights) => void
) => {
  if (!uid) return () => {};

  const expensesQuery = query(collection(db, 'expenses'));
  const settlementsQuery = query(collection(db, 'settlements'));
  const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));

  let allExpenses: ExpenseData[] = [];
  let allSettlements: SettlementData[] = [];
  let activeGroupsCount = 0;

  const calculate = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalPaid = 0;
    let totalReceived = 0;
    let largestExp = { title: 'None', amount: 0 };

    allExpenses.forEach((exp) => {
      const expDate = exp.createdAt?.seconds ? new Date(exp.createdAt.seconds * 1000) : new Date();
      if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
        // User paid for an expense
        if (exp.paidBy === uid) {
          totalPaid += exp.amount;
          if (exp.amount > largestExp.amount) {
            largestExp = { title: exp.title, amount: exp.amount };
          }
        }
      }
    });

    allSettlements.forEach((s) => {
      const sDate = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : new Date();
      if (sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear) {
        if (s.status === 'completed' || !s.status) {
          if (s.toUserId === uid) {
            totalReceived += s.amount;
          }
        }
      }
    });

    onUpdate({
      totalPaid,
      totalReceived,
      largestExpense: largestExp,
      activeGroupsCount,
    });
  };

  const unsub1 = onSnapshot(expensesQuery, (snap) => {
    allExpenses = snap.docs.map((d) => d.data() as ExpenseData);
    calculate();
  });

  const unsub2 = onSnapshot(settlementsQuery, (snap) => {
    allSettlements = snap.docs.map((d) => d.data() as SettlementData);
    calculate();
  });

  const unsub3 = onSnapshot(groupsQuery, (snap) => {
    activeGroupsCount = snap.docs.length;
    calculate();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
};

// -------------------------------------------------------------
// NOTIFICATIONS COLLECTION
// -------------------------------------------------------------
export const sendPaymentReminder = async (
  recipientUid: string,
  groupId: string,
  groupName: string,
  amount: number
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const notificationRef = doc(collection(db, 'notifications'));
    const notificationData: AppNotification = {
      notificationId: notificationRef.id,
      recipientUid,
      senderUid: currentUser.uid,
      groupId,
      groupName,
      type: 'payment_reminder',
      title: 'Payment Reminder',
      message: `${currentUser.displayName || 'A friend'} is reminding you to settle ₹${amount.toLocaleString('en-IN')} for ${groupName}.`,
      read: false,
      amount,
      createdAt: serverTimestamp(),
    };

    await setDoc(notificationRef, notificationData);
    return true;
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    throw error;
  }
};

export const canSendReminder = async (recipientUid: string, groupId: string) => {
  // Cooldown removed for testing
  return true;
};

export const subscribeToNotifications = (
  uid: string,
  onUpdate: (notifications: AppNotification[]) => void
) => {
  if (!uid) return () => {};

  // Query by recipient only to avoid index requirements for orderby
  const q = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid)
  );

  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map((d) => ({ ...d.data(), notificationId: d.id } as AppNotification));
    // Sort in memory to avoid index requirements
    notifs.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    onUpdate(notifs);
  });
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const leaveGroupInFirestore = async (groupId: string, uid: string) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const data = snap.data() as GroupData;
    const updatedMemberIds = (data.memberIds || []).filter(id => id !== uid);

    await updateDoc(groupRef, {
      memberIds: updatedMemberIds,
      updatedAt: serverTimestamp(),
    });

    // Also mark any invitations as 'declined' so they don't reappear
    const invQuery = query(
      collection(db, 'groupInvitations'),
      where('groupId', '==', groupId),
      where('toUserId', '==', uid)
    );
    const invSnap = await getDocs(invQuery);
    for (const d of invSnap.docs) {
      await updateDoc(d.ref, { status: 'declined', updatedAt: serverTimestamp() });
    }

    return true;
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error;
  }
};

export const transferGroupOwnership = async (groupId: string, newOwnerUid: string) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      createdBy: newOwnerUid,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error transferring group ownership:', error);
    throw error;
  }
};

export const toggleGroupArchive = async (groupId: string, isArchived: boolean) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      isArchived,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error toggling group archive:', error);
    throw error;
  }
};
