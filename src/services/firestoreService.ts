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
import { NotificationService } from './NotificationService';

// In-memory profile cache for reducing Firestore calls
const userProfileCache = new Map<string, { data: UserProfile | null; timestamp: number }>();
const userProfileListeners = new Map<string, Set<(profile: UserProfile | null) => void>>();
const userProfileUnsubscribers = new Map<string, () => void>();

/**
 * Real-time listener for a specific user profile with in-memory caching & deduplication
 */
export function subscribeToUserProfile(uid: string, onUpdate: (profile: UserProfile | null) => void) {
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  // 1. Immediately return cached profile if present
  const cached = userProfileCache.get(uid);
  if (cached) {
    onUpdate(cached.data);
  }

  // 2. Register callback to set of listeners for this uid
  if (!userProfileListeners.has(uid)) {
    userProfileListeners.set(uid, new Set());
  }
  const callbacks = userProfileListeners.get(uid)!;
  callbacks.add(onUpdate);

  // 3. If listener already attached to Firestore for this uid, reuse it
  if (!userProfileUnsubscribers.has(uid)) {
    const userRef = doc(db, 'users', uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const profile = snap.exists() ? (snap.data() as UserProfile) : null;
        userProfileCache.set(uid, { data: profile, timestamp: Date.now() });
        userProfileListeners.get(uid)?.forEach(cb => cb(profile));
      },
      (error) => {
        console.error('Error listening to user profile:', error);
      }
    );
    userProfileUnsubscribers.set(uid, unsub);
  }

  // 4. Return cleanup function
  return () => {
    const activeCallbacks = userProfileListeners.get(uid);
    if (activeCallbacks) {
      activeCallbacks.delete(onUpdate);
      if (activeCallbacks.size === 0) {
        userProfileListeners.delete(uid);
        const unsub = userProfileUnsubscribers.get(uid);
        if (unsub) {
          unsub();
          userProfileUnsubscribers.delete(uid);
        }
      }
    }
  };
}

export interface PaymentMethod {
  id: string;
  handle: string;
  type: 'UPI' | 'Bank' | 'Other';
  label: string;
  isDefault: boolean;
}

export interface UserGroupSummary {
  groupId: string;
  name: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  groupType?: string;
  netBalance?: number;
  role?: 'Admin' | 'Member';
  lastExpenseDate?: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
    createdAt: number;
  };
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
  groupsSummary?: UserGroupSummary[];
  createdAt?: any;
}

export interface GroupMemberDetail {
  uid: string;
  name: string;
  email?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  role?: 'Admin' | 'Member';
  joinedAt?: number;
  includeExistingExpenses?: boolean;
}

export interface GroupInvitation {
  invitationId?: string;
  groupId: string;
  groupName: string;
  groupPhotoUrl?: string;
  groupPhotoThumbnailUrl?: string;
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
  membersDetails?: GroupMemberDetail[];
  memberProfiles?: Record<string, GroupMemberDetail>;
  membersJoinedAt?: Record<string, number>;
  memberExistingExpensesPreference?: Record<string, boolean>;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
    createdAt: number;
  };
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
  receiptMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
    createdAt: number;
  };
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

export interface Contact {
  name: string;
  phone: string;
  email?: string;
  uid?: string; // Linked user ID if they exist on the platform
  photoUrl?: string;
}

/**
 * Reusable utility to remove undefined fields from an object recursively.
 * Firestore rejects 'undefined' but accepts 'null' or missing fields.
 */
export const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizeData(value)])
    );
  }
  return data;
};

// -------------------------------------------------------------
// USERS COLLECTION
// -------------------------------------------------------------
export const saveUserProfileToFirestore = async (profile: Partial<UserProfile> & { uid: string }) => {
  try {
    const userRef = doc(db, 'users', profile.uid);

    // Create the base data object
    const rawData: Record<string, any> = {
      uid: profile.uid,
      name: profile.name,
      email: profile.email,
      photoUrl: profile.photoUrl,
      photoThumbnailUrl: profile.photoThumbnailUrl,
      photoMetadata: profile.photoMetadata,
      paymentHandle: profile.paymentHandle,
      paymentMethods: profile.paymentMethods,
      dob: profile.dob,
      mobile: profile.mobile,
      emailVerified: profile.emailVerified,
      updatedAt: serverTimestamp(),
    };

    // Clean undefined fields to prevent Firestore crash
    const sanitized = sanitizeData(rawData);

    // Safety: Never allow local URIs to be saved
    if (sanitized.photoUrl && (sanitized.photoUrl.startsWith('file://') || sanitized.photoUrl.startsWith('content://'))) {
      delete sanitized.photoUrl;
    }

    await setDoc(userRef, sanitized, { merge: true });

    // Sync updated photo and name to all groups where this user is a member
    if (sanitized.photoUrl !== undefined || sanitized.photoThumbnailUrl !== undefined || sanitized.name !== undefined) {
      try {
        const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', profile.uid));
        const groupSnaps = await getDocs(groupsQuery);

        if (!groupSnaps.empty) {
          const batch = writeBatch(db);
          groupSnaps.forEach((groupDoc) => {
            const groupData = groupDoc.data();
            let needsUpdate = false;
            const updates: Record<string, any> = {};

            if (groupData.membersDetails && Array.isArray(groupData.membersDetails)) {
              const updatedDetails = groupData.membersDetails.map((m: any) => {
                if (m.uid === profile.uid) {
                  needsUpdate = true;
                  return {
                    ...m,
                    ...(sanitized.name && { name: sanitized.name }),
                    ...(sanitized.photoUrl !== undefined && { photoUrl: sanitized.photoUrl }),
                    ...(sanitized.photoThumbnailUrl !== undefined && { photoThumbnailUrl: sanitized.photoThumbnailUrl }),
                  };
                }
                return m;
              });
              if (needsUpdate) updates.membersDetails = updatedDetails;
            }

            if (groupData.memberProfiles && typeof groupData.memberProfiles === 'object') {
              const memberProfiles = { ...groupData.memberProfiles };
              if (memberProfiles[profile.uid]) {
                needsUpdate = true;
                memberProfiles[profile.uid] = {
                  ...memberProfiles[profile.uid],
                  ...(sanitized.name && { name: sanitized.name }),
                  ...(sanitized.photoUrl !== undefined && { photoUrl: sanitized.photoUrl }),
                  ...(sanitized.photoThumbnailUrl !== undefined && { photoThumbnailUrl: sanitized.photoThumbnailUrl }),
                };
                updates.memberProfiles = memberProfiles;
              }
            }

            if (needsUpdate) {
              batch.update(groupDoc.ref, updates);
            }
          });

          await batch.commit();
        }
      } catch (syncErr) {
        console.warn('[Firestore] Background profile sync to groups error:', syncErr);
      }
    }

    return sanitized;
  } catch (error: any) {
    console.error('Firestore Error in saveUserProfileToFirestore:', error);
    throw error;
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

/**
 * Checks if a mobile number is already registered to another user
 */
export const isMobileNumberRegistered = async (mobile: string, currentUid: string): Promise<boolean> => {
  try {
    // Standardize to include country code if not present, or search both
    const q = query(
      collection(db, 'users'),
      where('mobile', 'in', [mobile, `+91 ${mobile}`, `+91${mobile}`])
    );
    const snap = await getDocs(q);

    // If any user is found with this mobile, check if it's NOT the current user
    return snap.docs.some(d => d.id !== currentUid);
  } catch (error) {
    console.error('Error checking mobile registration:', error);
    return false;
  }
};

/**
 * Searches for a user by their exact phone number
 */
export const findUserByPhone = async (phoneNumber: string): Promise<UserProfile | null> => {
  try {
    const rawDigits = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    if (!rawDigits || rawDigits.length < 10) return null;

    // Standard practice: Search by indexed mobile field
    const q = query(collection(db, 'users'), where('mobile', '==', phoneNumber));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }

    // Fallback: If formatting differs, scan manually (expensive but small scale)
    const querySnap = await getDocs(collection(db, 'users'));
    for (const docSnap of querySnap.docs) {
      const data = docSnap.data() as UserProfile;
      if (data.mobile) {
        const userRawDigits = data.mobile.replace(/[^0-9]/g, '').slice(-10);
        if (userRawDigits === rawDigits) {
          return data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
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

export const addContactToUserFirestore = async (currentUid: string, contact: Contact): Promise<void> => {
  try {
    // Generate a stable ID based on phone number to avoid duplicates
    const contactId = contact.phone.replace(/[^0-9]/g, '');
    const contactRef = doc(db, 'users', currentUid, 'contacts', contactId);

    await setDoc(contactRef, {
      ...contact,
      addedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error adding contact:', error);
  }
};

export const removeContactFromUserFirestore = async (currentUid: string, contactPhone: string): Promise<void> => {
  try {
    const contactId = contactPhone.replace(/[^0-9]/g, '');
    const contactRef = doc(db, 'users', currentUid, 'contacts', contactId);
    await deleteDoc(contactRef);
  } catch (error) {
    console.error('Error removing contact:', error);
    throw error;
  }
};

export const getSavedUserContactsFromFirestore = async (currentUid: string): Promise<Contact[]> => {
  try {
    const contactsSnap = await getDocs(collection(db, 'users', currentUid, 'contacts'));
    return contactsSnap.docs.map((d) => d.data() as Contact);
  } catch (error) {
    console.error('Error fetching saved contacts:', error);
    return [];
  }
};

export const subscribeToUserContacts = (uid: string, onUpdate: (contacts: Contact[]) => void) => {
  const contactsRef = collection(db, 'users', uid, 'contacts');
  return onSnapshot(contactsRef, (snap) => {
    const contacts = snap.docs.map(d => d.data() as Contact);
    onUpdate(contacts);
  });
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
    photoThumbnailUrl?: string;
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
      ...(extraDetails?.photoThumbnailUrl && { photoThumbnailUrl: extraDetails.photoThumbnailUrl }),
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
          groupPhotoUrl: extraDetails?.photoUrl || '',
          groupPhotoThumbnailUrl: extraDetails?.photoThumbnailUrl || '',
          fromUserId: currentUser.uid,
          toUserId: invitedUid,
          invitedByName: currentUser.displayName || 'Group Admin',
          includeExistingExpenses: true,
          status: 'pending',
          createdAt: serverTimestamp(),
        };
        await setDoc(invRef, invData);
        console.log(`✓ INVITATION WRITTEN SUCCESSFULLY for user ${invitedUid} (invId: ${invRef.id})`);

        // Send Push + In-App Notification
        await NotificationService.notifyUser(invitedUid, {
          type: 'GROUP_INVITE',
          title: 'Group Invitation',
          message: `${currentUser.displayName || 'Someone'} added you to the group "${name.trim()}"`,
          data: { groupId: groupRef.id, groupName: name.trim() }
        });
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
        groupPhotoUrl: groupData.photoUrl || '',
        groupPhotoThumbnailUrl: groupData.photoThumbnailUrl || '',
        fromUserId: currentUser.uid,
        toUserId: newMemberUid,
        invitedByName: currentUser.displayName || 'Group Admin',
        includeExistingExpenses,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      await setDoc(invRef, invData);
      console.log(`✓ INVITATION WRITTEN SUCCESSFULLY for user ${newMemberUid} (invId: ${invRef.id})`);

      // Send Push + In-App Notification
      await NotificationService.notifyUser(newMemberUid, {
        type: 'GROUP_INVITE',
        title: 'Group Invitation',
        message: `${currentUser.displayName || 'Someone'} added you to the group "${groupData.name || 'Group'}"`,
        data: { groupId, groupName: groupData.name || 'Group' }
      });
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
    const sanitized = sanitizeData({
      ...data,
      updatedAt: serverTimestamp(),
    });

    // Safety check
    if (sanitized.photoUrl && (sanitized.photoUrl.startsWith('file://') || sanitized.photoUrl.startsWith('content://'))) {
      delete sanitized.photoUrl;
    }

    await setDoc(groupRef, sanitized, { merge: true });

    // 2. Cascade changes to pending invitations (Name and Photo)
    // This ensures invited users see the latest info in their dashboard
    // We check !== undefined to capture cases where a photo is being removed (set to '')
    if (data.name !== undefined || data.photoUrl !== undefined || data.photoThumbnailUrl !== undefined) {
      const invQuery = query(
        collection(db, 'groupInvitations'),
        where('groupId', '==', groupId),
        where('status', '==', 'pending')
      );

      const invSnap = await getDocs(invQuery);
      const updates = invSnap.docs.map(invDoc => {
        const invUpdate: any = {};
        if (data.name !== undefined) invUpdate.groupName = data.name.trim();
        if (data.photoUrl !== undefined) invUpdate.groupPhotoUrl = data.photoUrl;
        if (data.photoThumbnailUrl !== undefined) invUpdate.groupPhotoThumbnailUrl = data.photoThumbnailUrl;

        return updateDoc(invDoc.ref, {
          ...invUpdate,
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(updates);
    }
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
};

export const deleteGroupFromFirestore = async (groupId: string) => {
  try {
    console.log(`[Firestore] Starting cascading delete/cancel for group: ${groupId}`);

    // 0. Fetch group to get member IDs (important for finding invitations reliably)
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    const memberIds = groupSnap.exists() ? (groupSnap.data() as GroupData).memberIds || [] : [];

    // 1. Find all invitations associated with this group
    const invIdsToProcess = new Set<string>();

    // Path A: Query by groupId (might be restricted by rules for "list" operations)
    const invQuery = query(collection(db, 'groupInvitations'), where('groupId', '==', groupId));
    const invSnap = await getDocs(invQuery);
    invSnap.docs.forEach(d => invIdsToProcess.add(d.id));

    // Path B: Check per member (more reliable under granular rules)
    if (memberIds.length > 0) {
      for (const uid of memberIds) {
        const mInvQuery = query(
          collection(db, 'groupInvitations'),
          where('groupId', '==', groupId),
          where('toUserId', '==', uid)
        );
        const mInvSnap = await getDocs(mInvQuery);
        mInvSnap.docs.forEach(d => invIdsToProcess.add(d.id));
      }
    }

    console.log(`[Firestore] Found ${invIdsToProcess.size} unique invitations to handle`);

    // Instead of just deleting, we also MARK them as 'cancelled'.
    // This is a safety measure because the Owner might not have permission to 'delete'
    // a document from the recipient's inbox, but they usually have 'update' permission
    // on documents they created (fromUserId).
    const invOps = Array.from(invIdsToProcess).map(async (id) => {
      const ref = doc(db, 'groupInvitations', id);
      try {
        // Try to update status first (to hide it immediately for the recipient)
        await updateDoc(ref, {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });
        // Then try to delete it
        await deleteDoc(ref);
      } catch (err) {
        console.warn(`[Firestore] Non-critical: Could not fully delete invitation ${id}. It is now marked as cancelled.`);
      }
    });
    await Promise.all(invOps);

    // 2. Delete all expenses associated with this group
    const expQuery = query(collection(db, 'expenses'), where('groupId', '==', groupId));
    const expSnap = await getDocs(expQuery);
    console.log(`[Firestore] Found ${expSnap.docs.length} expenses to delete`);
    const expDeleteOps = expSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(expDeleteOps);

    // 3. Delete all settlements associated with this group
    const setQuery = query(collection(db, 'settlements'), where('groupId', '==', groupId));
    const setSnap = await getDocs(setQuery);
    console.log(`[Firestore] Found ${setSnap.docs.length} settlements to delete`);
    const setDeleteOps = setSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(setDeleteOps);

    // 4. Delete all notifications associated with this group
    const notifQuery = query(collection(db, 'notifications'), where('groupId', '==', groupId));
    const notifSnap = await getDocs(notifQuery);
    console.log(`[Firestore] Found ${notifSnap.docs.length} notifications to delete`);
    const notifDeleteOps = notifSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(notifDeleteOps);

    // 5. Finally, delete the group document itself
    await deleteDoc(groupRef);

    console.log(`[Firestore] Group ${groupId} and all related data cleaned up successfully.`);
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
      try {
        // Try to update status first (to hide it immediately)
        await updateDoc(docSnap.ref, {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });
        // Then try to delete
        await deleteDoc(docSnap.ref);
      } catch (err) {
        console.warn(`[Firestore] Non-critical: Could not fully delete invitation ${docSnap.id}. It is now marked as cancelled.`);
      }
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
  const invQuery = query(collection(db, 'groupInvitations'), where('groupId', '==', groupId));

  let currentGroup: GroupData | null = null;
  let allInvitations: any[] = [];
  let userMap = new Map<string, UserProfile>();
  let userUnsubs = new Map<string, () => void>();

  const notify = () => {
    if (!currentGroup) return;

    const memberIds = currentGroup.memberIds || [];
    const createdBy = currentGroup.createdBy;

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

  const unsubGroup = onSnapshot(groupRef, (snap) => {
    if (snap.exists()) {
      currentGroup = snap.data() as GroupData;
      const ids = currentGroup.memberIds || [];

      // Setup listeners for each user
      ids.forEach(uid => {
        if (!userUnsubs.has(uid)) {
          const unsub = subscribeToUserProfile(uid, (profile) => {
            if (profile) {
              userMap.set(uid, profile);
              notify();
            }
          });
          userUnsubs.set(uid, unsub);
        }
      });
      notify();
    }
  });

  const unsubInvs = onSnapshot(invQuery, (snap) => {
    allInvitations = snap.docs.map(d => d.data());
    notify();
  });

  return () => {
    unsubGroup();
    unsubInvs();
    userUnsubs.forEach(u => u());
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
    const subcollExpenseRef = doc(db, 'groups', expense.groupId, 'expenses', expenseRef.id);
    
    const expenseData = {
      ...expense,
      expenseId: expenseRef.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };

    // Write to both subcollection & legacy top-level for 100% backward compatibility
    await Promise.all([
      setDoc(expenseRef, expenseData),
      setDoc(subcollExpenseRef, expenseData)
    ]);

    // Notify other group members
    try {
      const groupSnap = await getDoc(doc(db, 'groups', expense.groupId));
      if (groupSnap.exists()) {
        const gData = groupSnap.data() as GroupData;
        const otherMembers = (gData.memberIds || []).filter(uid => uid !== user.uid);

        const notifyOps = otherMembers.map(uid =>
          NotificationService.notifyUser(uid, {
            type: 'EXPENSE',
            title: 'New Expense',
            message: `${user.displayName || 'Someone'} added ₹${expense.amount} for "${expense.title}" in ${gData.name}`,
            data: { groupId: expense.groupId, expenseId: expenseRef.id, groupName: gData.name }
          })
        );
        await Promise.all(notifyOps);
      }
    } catch (notifErr) {
      console.error('Error sending expense notifications:', notifErr);
    }

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

    // Notify expense creator
    try {
      const expSnap = await getDoc(doc(db, 'expenses', expenseId));
      if (expSnap.exists()) {
        const expData = expSnap.data() as ExpenseData;
        if (expData.createdBy && expData.createdBy !== user.uid) {
          await NotificationService.notifyUser(expData.createdBy, {
            type: 'COMMENT',
            title: 'New Comment',
            message: `${user.displayName || 'Someone'} commented on your expense "${expData.title}"`,
            data: { groupId: expData.groupId, expenseId, groupName: '' } // Fetch group name if needed
          });
        }
      }
    } catch (e) {
      console.error('Comment notif error:', e);
    }

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

    // Notify recipient
    try {
      const user = auth.currentUser;
      if (user) {
        const recipientId = settlement.toUserId === user.uid ? settlement.fromUserId : settlement.toUserId;
        await NotificationService.notifyUser(recipientId, {
          type: 'SETTLEMENT',
          title: 'Settlement Done',
          message: `${user.displayName || 'Someone'} settled ₹${settlement.amount}`,
          data: { groupId: settlement.groupId }
        });
      }
    } catch (e) {
      console.error('Settlement notif error:', e);
    }

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
  id?: string;
  userId: string;
  type: 'GROUP_INVITE' | 'REMINDER' | 'EXPENSE' | 'COMMENT' | 'SETTLEMENT' | 'payment_reminder' | 'group_invitation' | 'general';
  title: string;
  message: string;
  data: {
    groupId?: string;
    expenseId?: string;
    groupName?: string;
    amount?: number;
    senderName?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: any;

  // Top-level fields for convenience/legacy
  notificationId?: string;
  recipientUid?: string;
  senderUid?: string;
  senderName?: string;
  groupId?: string;
  groupName?: string;
  amount?: number;
  read?: boolean;
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

    // Fetch sender's real-time profile for name and photo
    const profile = await getUserProfileFromFirestore(currentUser.uid);
    const senderName = profile?.name || currentUser.displayName || 'A friend';
    const senderPhoto = profile?.photoUrl || currentUser.photoURL || '';

    await NotificationService.notifyUser(recipientUid, {
      type: 'REMINDER',
      title: 'Payment Reminder',
      message: `${senderName} sent you a reminder to settle ${formatCurrency(amount)} in ${groupName || 'Group'}`,
      data: {
        groupId,
        amount,
        groupName: groupName || 'Group',
        senderName: senderName,
        senderUid: currentUser.uid,
        senderPhotoUrl: senderPhoto
      }
    });

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

  // Support both legacy and new schema during migration
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid)
  );

  const qLegacy = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', uid)
  );

  // For simplicity in this task, I'll just use the new schema primarily
  // and combine or focus on the new one as requested.
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AppNotification));
    // Sort in memory to avoid index requirements
    notifs.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    onUpdate(notifs);
  });
};

export const markNotificationAsRead = async (notificationId: string | undefined) => {
  if (!notificationId) {
    console.warn('markNotificationAsRead: No notificationId provided');
    return;
  }
  try {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, {
      isRead: true,
      read: true // fallback for legacy
    });
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

/**
 * Searches for users by email or mobile number (case-insensitive)
 */
export const searchUsersByContact = async (queryText: string): Promise<UserProfile[]> => {
  const normalized = queryText.trim().toLowerCase();
  if (!normalized) return [];

  try {
    const allUsers = await getAllUsersFromFirestore();
    return allUsers.filter(u => {
      const emailMatch = u.email?.toLowerCase().includes(normalized);
      const mobileMatch = u.mobile?.includes(normalized);
      const nameMatch = u.name?.toLowerCase().includes(normalized);
      return (emailMatch || mobileMatch || nameMatch) && u.uid !== auth.currentUser?.uid;
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};
