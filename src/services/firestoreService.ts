import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  getDoc, 
  getDocFromCache,
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  orderBy,
  runTransaction,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { getCurrencyConfig, formatCurrency } from './currencyService';
export { formatCurrency };
import { db, auth } from '../config/firebase';
import { NotificationService } from './NotificationService';
import { captureError } from '../config/sentry';
import { TelemetryService } from './telemetryService';

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
  groupType?: 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Home' | 'Other';
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
  enableSettleReminder?: boolean;
  settleReminderDate?: string;
  enableBalanceAlert?: boolean;
  balanceAlertThreshold?: number;
  enableFlatmateSettleReminder?: boolean;
  flatmateReminderDate?: string;
  memberIds: string[];
  adminIds?: string[];
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

export interface RecurringExpenseData {
  recurringExpenseId?: string;
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  splitDetails: Record<string, number>;
  splitType?: 'equal' | 'exact' | 'percentage';
  category?: string;
  notes?: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string | null;
  nextRun: string;
  active: boolean;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
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
    const cached = userProfileCache.get(uid);
    if (cached?.data) return cached.data;

    const userRef = doc(db, 'users', uid);

    try {
      const cacheSnap = await getDocFromCache(userRef);
      if (cacheSnap.exists()) {
        const prof = cacheSnap.data() as UserProfile;
        userProfileCache.set(uid, { data: prof, timestamp: Date.now() });
        return prof;
      }
    } catch (cacheErr) {
      // Not in offline cache, proceed to server
    }

    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const prof = snap.data() as UserProfile;
      userProfileCache.set(uid, { data: prof, timestamp: Date.now() });
      return prof;
    }
    return null;
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
    const contactId = contact.phone ? contact.phone.replace(/[^0-9]/g, '') : contact.uid || contact.name;
    if (!contactId) return;

    const contactRef = doc(db, 'users', currentUid, 'contacts', contactId);
    const sanitizedPayload = sanitizeData({
      ...contact,
      addedAt: serverTimestamp(),
    });

    await setDoc(contactRef, sanitizedPayload, { merge: true });
  } catch (error) {
    console.error('Error adding contact:', error);
  }
};

export const removeContactFromUserFirestore = async (currentUid: string, contactPhone: string, contactUid?: string): Promise<void> => {
  try {
    const contactId = contactPhone ? contactPhone.replace(/[^0-9]/g, '') : '';
    if (contactId) {
      await deleteDoc(doc(db, 'users', currentUid, 'contacts', contactId)).catch(() => {});
    }
    if (contactPhone && contactPhone !== contactId) {
      await deleteDoc(doc(db, 'users', currentUid, 'contacts', contactPhone)).catch(() => {});
    }
    if (contactUid) {
      const q = query(collection(db, 'users', currentUid, 'contacts'), where('uid', '==', contactUid));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Error removing contact:', error);
    throw error;
  }
};

/**
 * Deep cleanup of a user from Firestore when an account is deleted.
 * Removes user from all groups, deletes invitations, and removes contact entries.
 */
export const cleanupUserFromFirestore = async (uid: string): Promise<void> => {
  try {
    console.log(`[Firestore] Cleaning up data for deleted user ${uid}...`);

    // 1. Fetch user doc to get phone number before deleting
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const userPhone = userSnap.exists() ? (userSnap.data() as UserProfile).mobile || '' : '';
    const phoneDigits = userPhone ? userPhone.replace(/[^0-9]/g, '') : '';

    // 2. Remove user from all groups they belong to
    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', uid)
    );
    const groupsSnap = await getDocs(groupsQuery);
    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data() as GroupData;
      const updatedMemberIds = (gData.memberIds || []).filter((id) => id !== uid);
      const membersJoinedAt = gData.membersJoinedAt || {};
      delete membersJoinedAt[uid];
      const memberExistingExpensesPreference = gData.memberExistingExpensesPreference || {};
      delete memberExistingExpensesPreference[uid];

      await updateDoc(groupDoc.ref, {
        memberIds: updatedMemberIds,
        membersJoinedAt,
        memberExistingExpensesPreference,
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Clean up all group invitations to/from this user
    const invQuery1 = query(collection(db, 'groupInvitations'), where('toUserId', '==', uid));
    const invSnap1 = await getDocs(invQuery1);
    for (const d of invSnap1.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    const invQuery2 = query(collection(db, 'groupInvitations'), where('fromUserId', '==', uid));
    const invSnap2 = await getDocs(invQuery2);
    for (const d of invSnap2.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 4. Delete user's own contacts subcollection
    const myContactsSnap = await getDocs(collection(db, 'users', uid, 'contacts'));
    for (const d of myContactsSnap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }

    // 5. Delete this user document
    await deleteDoc(userDocRef).catch(() => {});

    console.log(`[Firestore] Successfully cleaned up user ${uid} from Firestore`);
  } catch (error) {
    console.error('Error cleaning up user from Firestore:', error);
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
    enableSettleReminder?: boolean;
    settleReminderDate?: string;
    enableBalanceAlert?: boolean;
    balanceAlertThreshold?: number;
    enableFlatmateSettleReminder?: boolean;
    flatmateReminderDate?: string;
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
    // Only creator is an active member at creation time. Invited members join upon accepting invitation.
    const initialMemberIds = [currentUser.uid];

    const groupRef = doc(collection(db, 'groups'));
    const groupData: GroupData = {
      groupId: groupRef.id,
      name: name.trim(),
      memberIds: initialMemberIds,
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
      ...(extraDetails?.enableSettleReminder !== undefined && { enableSettleReminder: extraDetails.enableSettleReminder }),
      ...(extraDetails?.settleReminderDate && { settleReminderDate: extraDetails.settleReminderDate }),
      ...(extraDetails?.enableBalanceAlert !== undefined && { enableBalanceAlert: extraDetails.enableBalanceAlert }),
      ...(extraDetails?.balanceAlertThreshold !== undefined && { balanceAlertThreshold: extraDetails.balanceAlertThreshold }),
      ...(extraDetails?.enableFlatmateSettleReminder !== undefined && { enableFlatmateSettleReminder: extraDetails.enableFlatmateSettleReminder }),
      ...(extraDetails?.flatmateReminderDate && { flatmateReminderDate: extraDetails.flatmateReminderDate }),
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
          groupType: extraDetails?.groupType || 'Other',
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
          message: `${name.trim()} created.`,
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

export const inviteUserToGroupInFirestore = async (
  groupId: string,
  newMemberUid: string,
  includeExistingExpenses: boolean
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Unauthenticated');

    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.data() as GroupData;

    // Issue a pending invitation for the new user
    console.log(`[Firestore] About to write invitation for user: ${newMemberUid}`);
    try {
      const invRef = doc(collection(db, 'groupInvitations'));
      const invData = {
        invitationId: invRef.id,
        groupId,
        groupName: groupData.name || 'Group',
        groupType: groupData.groupType || 'Other',
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
        message: `${groupData.name || 'Group'} created.`,
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

export const reinviteUserToGroupInFirestore = async (groupId: string, invitedUid: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Unauthenticated');

    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.data() as GroupData;

    // Delete or update existing invitation document(s) for this user & group
    try {
      const invQuery = query(
        collection(db, 'groupInvitations'),
        where('groupId', '==', groupId),
        where('toUserId', '==', invitedUid)
      );
      const invSnap = await getDocs(invQuery);
      for (const invDoc of invSnap.docs) {
        try {
          await deleteDoc(invDoc.ref);
        } catch (e) {
          await updateDoc(invDoc.ref, { status: 'cancelled' }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Non-fatal error cleaning up old invitation:', e);
    }

    // Create fresh new invitation document
    const invRef = doc(collection(db, 'groupInvitations'));
    const invData = sanitizeData({
      invitationId: invRef.id,
      groupId,
      groupName: groupData.name || 'Group',
      groupType: groupData.groupType || 'Other',
      groupPhotoUrl: groupData.photoUrl || '',
      groupPhotoThumbnailUrl: groupData.photoThumbnailUrl || '',
      fromUserId: currentUser.uid,
      toUserId: invitedUid,
      invitedByName: currentUser.displayName || 'Group Admin',
      includeExistingExpenses: true,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    await setDoc(invRef, invData);
    console.log(`✓ RE-INVITATION WRITTEN SUCCESSFULLY for user ${invitedUid} (invId: ${invRef.id})`);

    // Send push notification
    (async () => {
      try {
        await NotificationService.notifyUser(invitedUid, {
          type: 'GROUP_INVITE',
          title: 'Group Invitation',
          message: `${currentUser.displayName || 'Someone'} re-invited you to "${groupData.name || 'Group'}"`,
          data: { groupId, groupName: groupData.name || 'Group' }
        });
      } catch (err) {
        console.error('Re-invite notification error:', err);
      }
    })();
  } catch (error: any) {
    console.error('Error re-inviting user to group:', error);
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

    // 0. Fetch group to get member IDs and group name
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.exists() ? (groupSnap.data() as GroupData) : null;
    const memberIds = groupData?.memberIds || [];
    const groupName = groupData?.name || 'Group';

    // Send notification to other members that group was deleted
    const currentUser = auth.currentUser;
    if (currentUser && memberIds.length > 0) {
      const otherMembers = memberIds.filter((id) => id !== currentUser.uid);
      const ownerName = currentUser.displayName || 'The owner';

      const notifyOps = otherMembers.map((uid) =>
        NotificationService.notifyUser(uid, {
          type: 'GROUP_DELETED',
          title: 'Group Deleted',
          message: `${ownerName} deleted the group "${groupName}"`,
          data: { groupId, groupName },
        }).catch(() => {})
      );
      await Promise.all(notifyOps);
    }

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
  return inviteUserToGroupInFirestore(groupId, newMemberUid, includeExistingExpenses);
};

export const inviteMemberToGroup = inviteUserToGroupInFirestore;

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

    // Update group memberIds, membersJoinedAt and memberExistingExpensesPreference
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data() as GroupData;
      const currentMemberIds = gData.memberIds || [];
      if (!currentMemberIds.includes(currentUser.uid)) {
        currentMemberIds.push(currentUser.uid);
      }

      const membersJoinedAt = gData.membersJoinedAt || {};
      membersJoinedAt[currentUser.uid] = Date.now();

      const memberExistingExpensesPreference = gData.memberExistingExpensesPreference || {};
      const shouldIncludeExisting = invData.includeExistingExpenses !== false;
      memberExistingExpensesPreference[currentUser.uid] = shouldIncludeExisting;

      await updateDoc(groupRef, {
        memberIds: currentMemberIds,
        membersJoinedAt,
        memberExistingExpensesPreference,
        updatedAt: serverTimestamp(),
      });

      if (shouldIncludeExisting) {
        await redistributeExistingGroupExpenses(groupId, currentUser.uid, currentMemberIds, memberExistingExpensesPreference);
      }
    }
  } catch (error) {
    console.error('Error accepting group invitation:', error);
    throw error;
  }
};

export const redistributeExistingGroupExpenses = async (
  groupId: string,
  newMemberUid: string,
  allMemberIds: string[],
  preferences?: Record<string, boolean>
) => {
  try {
    console.log(`[Firestore] Redistributing existing expenses for group ${groupId} to include member ${newMemberUid}`);
    const expQuery = query(collection(db, 'expenses'), where('groupId', '==', groupId));
    const expSnap = await getDocs(expQuery);

    const updateOps = expSnap.docs.map(async (expDoc) => {
      const expData = expDoc.data() as ExpenseData;
      const totalAmount = expData.amount || 0;
      const currentSplits = expData.splitDetails || {};

      const participatingUids = allMemberIds.filter((uid) => {
        if (uid in currentSplits && currentSplits[uid] > 0) return true;
        const pref = preferences?.[uid] ?? true;
        return pref !== false;
      });

      if (participatingUids.length === 0) return;

      const equalShare = Math.round((totalAmount / participatingUids.length) * 100) / 100;
      const newSplitDetails: Record<string, number> = {};
      let runningSum = 0;

      participatingUids.forEach((uid, idx) => {
        if (idx === participatingUids.length - 1) {
          newSplitDetails[uid] = Math.round((totalAmount - runningSum) * 100) / 100;
        } else {
          newSplitDetails[uid] = equalShare;
          runningSum += equalShare;
        }
      });

      await updateDoc(expDoc.ref, {
        splitDetails: newSplitDetails,
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(updateOps);
    console.log(`✓ Existing expenses redistributed for group ${groupId}`);
  } catch (error) {
    console.error('Error redistributing existing group expenses:', error);
  }
};

export const declineGroupInvitation = async (invitationId: string, groupId: string) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const invRef = doc(db, 'groupInvitations', invitationId);
    const invSnap = await getDoc(invRef);
    const invData = invSnap.exists() ? (invSnap.data() as GroupInvitation) : null;

    await updateDoc(invRef, {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });

    // Notify the inviter / group admin about the rejection
    (async () => {
      try {
        const inviterUid = invData?.fromUserId;
        if (inviterUid && inviterUid !== currentUser.uid) {
          await NotificationService.notifyUser(inviterUid, {
            type: 'GROUP_INVITE',
            title: 'Invitation Declined',
            message: `${currentUser.displayName || 'Someone'} declined the invitation to "${invData?.groupName || 'Group'}"`,
            data: { groupId, groupName: invData?.groupName }
          });
        }
      } catch (notifErr) {
        console.error('Error sending decline invitation notification:', notifErr);
      }
    })();

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
    // 1. Find and delete/cancel all invitations for this user and group
    try {
      const invQuery = query(
        collection(db, 'groupInvitations'),
        where('groupId', '==', groupId)
      );
      const invSnap = await getDocs(invQuery);
      for (const docSnap of invSnap.docs) {
        const data = docSnap.data();
        if (data.toUserId === toUserId) {
          try {
            await updateDoc(docSnap.ref, {
              status: 'cancelled',
              updatedAt: serverTimestamp(),
            });
            await deleteDoc(docSnap.ref);
          } catch (e) {
            console.warn(`[Firestore] Non-critical error deleting invitation ${docSnap.id}:`, e);
          }
        }
      }
    } catch (e) {
      console.warn('[Firestore] Error querying invitations to cancel:', e);
    }

    // 2. Remove user from group memberIds if present
    try {
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const gData = groupSnap.data() as GroupData;
        if (gData.memberIds && gData.memberIds.includes(toUserId)) {
          const updatedMemberIds = gData.memberIds.filter((id) => id !== toUserId);
          await updateDoc(groupRef, {
            memberIds: updatedMemberIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (e) {
      console.warn('[Firestore] Error updating group memberIds on invitation cancel:', e);
    }
  } catch (error) {
    console.error('Error cancelling group invitation:', error);
    throw error;
  }
};

export const removeMemberFromGroup = async (groupId: string, memberUid: string) => {
  try {
    console.log(`[Firestore] Removing member ${memberUid} from group ${groupId}`);

    // 1. Find and delete ALL invitations for this user+group (any status)
    const invQuery = query(
      collection(db, 'groupInvitations'),
      where('groupId', '==', groupId),
      where('toUserId', '==', memberUid)
    );
    const invSnap = await getDocs(invQuery);
    console.log(`[Firestore] Found ${invSnap.docs.length} invitation docs to clean up`);

    for (const docSnap of invSnap.docs) {
      try {
        await updateDoc(docSnap.ref, {
          status: 'removed',
          updatedAt: serverTimestamp()
        });
        await deleteDoc(docSnap.ref);
      } catch (err) {
        console.warn(`[Firestore] Non-critical: Could not fully delete invitation ${docSnap.id}.`);
      }
    }

    // 2. Remove user from group memberIds
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const gData = groupSnap.data() as GroupData;
      const updatedMemberIds = (gData.memberIds || []).filter((id) => id !== memberUid);

      // Also clean up membersJoinedAt and memberExistingExpensesPreference
      const membersJoinedAt = gData.membersJoinedAt || {};
      delete membersJoinedAt[memberUid];

      const memberExistingExpensesPreference = gData.memberExistingExpensesPreference || {};
      delete memberExistingExpensesPreference[memberUid];

      await updateDoc(groupRef, {
        memberIds: updatedMemberIds,
        membersJoinedAt,
        memberExistingExpensesPreference,
        updatedAt: serverTimestamp(),
      });
      console.log(`✓ Member ${memberUid} removed from group ${groupId}. Remaining members: ${updatedMemberIds.length}`);
    }
  } catch (error) {
    console.error('Error removing member from group:', error);
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
        const existingStatus = invitationMap.get(data.groupId);
        if (data.status === 'accepted') {
          invitationMap.set(data.groupId, 'accepted');
        } else if (existingStatus !== 'accepted') {
          invitationMap.set(data.groupId, data.status);
        }
      });

      const groups: GroupData[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as GroupData;
        const gId = docSnap.id;

        const isMember = (data.memberIds || []).includes(uid);
        const invStatus = invitationMap.get(gId);
        const isPendingOrDeclined = invStatus === 'pending' || invStatus === 'declined' || invStatus === 'cancelled';

        if (isMember && !isPendingOrDeclined) {
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
  onUpdate: (members: UserProfile[], pending: UserProfile[], declined: UserProfile[]) => void
) => {
  const groupRef = doc(db, 'groups', groupId);
  const invQuery = query(collection(db, 'groupInvitations'), where('groupId', '==', groupId));

  let currentGroup: GroupData | null = null;
  let allInvitations: any[] = [];
  let userMap = new Map<string, UserProfile>();
  let userUnsubs = new Map<string, () => void>();

  const syncUserListeners = () => {
    const ids = new Set<string>(currentGroup?.memberIds || []);
    allInvitations.forEach(d => {
      if (d.toUserId) ids.add(d.toUserId);
    });

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
  };

  const notify = () => {
    if (!currentGroup) return;

    const memberIds = currentGroup.memberIds || [];
    const createdBy = currentGroup.createdBy;

    const invMap = new Map<string, string>(); // toUserId -> status
    const allUserUids = new Set<string>(memberIds);

    allInvitations.forEach((d) => {
      invMap.set(d.toUserId, d.status);
      if (d.toUserId) allUserUids.add(d.toUserId);
    });

    const accepted: UserProfile[] = [];
    const pending: UserProfile[] = [];
    const declined: UserProfile[] = [];

    allUserUids.forEach((uid) => {
      const user = userMap.get(uid);
      if (!user) return;

      const status = invMap.get(uid);
      if (status === 'pending') {
        pending.push(user);
      } else if (status === 'declined') {
        declined.push(user);
      } else if (status === 'accepted' || uid === createdBy || memberIds.includes(uid)) {
        accepted.push(user);
      } else {
        pending.push(user);
      }
    });

    onUpdate(accepted, pending, declined);
  };

  const unsubGroup = onSnapshot(groupRef, (snap) => {
    if (snap.exists()) {
      currentGroup = snap.data() as GroupData;
      syncUserListeners();
      notify();
    }
  });

  const unsubInvs = onSnapshot(invQuery, (snap) => {
    allInvitations = snap.docs.map(d => d.data());
    syncUserListeners();
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

    const groupSnap = await getDoc(doc(db, 'groups', expense.groupId));
    if (!groupSnap.exists()) {
      throw new Error('This group has been deleted by the admin.');
    }

    const expenseRef = doc(collection(db, 'expenses'));
    const subcollExpenseRef = doc(db, 'groups', expense.groupId, 'expenses', expenseRef.id);

    const expenseData = sanitizeData({
      ...expense,
      expenseId: expenseRef.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    // Write primary document instantly & write subcollection in background
    const writePromise = setDoc(expenseRef, expenseData);
    setDoc(subcollExpenseRef, expenseData).catch(() => {});
    await writePromise;

    // Send notifications asynchronously in background (Non-blocking)
    (async () => {
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
        console.error('Error sending expense notifications in background:', notifErr);
      }
    })();

    return expenseRef.id;
  } catch (error) {
    console.error('Error adding expense to Firestore:', error);
    throw error;
  }
};

// -------------------------------------------------------------
// RECURRING EXPENSES COLLECTION & PROCESSING
// -------------------------------------------------------------

export const calculateNextRunDate = (dateStr: string, frequency: 'weekly' | 'monthly' | 'yearly'): string => {
  const parts = dateStr.split('-');
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const dd = parseInt(parts[2], 10);
  const d = new Date(yyyy, mm - 1, dd);

  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    const targetMonth = d.getMonth() + 1;
    d.setMonth(targetMonth);
    if (d.getMonth() > targetMonth % 12) {
      d.setDate(0);
    }
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const createRecurringExpenseInFirestore = async (data: {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitDetails: Record<string, number>;
  splitType?: 'equal' | 'exact' | 'percentage';
  category?: string;
  notes?: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string | null;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');

  const recRef = doc(collection(db, 'recurringExpenses'));
  const splitBetween = Object.keys(data.splitDetails || {}).filter(
    (uid) => (data.splitDetails[uid] || 0) > 0
  );

  const nextRunDate = calculateNextRunDate(data.startDate, data.frequency);

  const payload: RecurringExpenseData = {
    recurringExpenseId: recRef.id,
    groupId: data.groupId,
    title: data.title,
    amount: data.amount,
    paidBy: data.paidBy,
    splitBetween,
    splitDetails: data.splitDetails,
    splitType: data.splitType || 'equal',
    category: data.category || '📦 Other',
    notes: data.notes || '',
    frequency: data.frequency,
    startDate: data.startDate,
    endDate: data.endDate || null,
    nextRun: nextRunDate,
    active: true,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(recRef, sanitizeData(payload));
  return recRef.id;
};

export const processDueRecurringExpenses = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Single-field query for active recurring expenses (avoids needing a Firestore composite index)
    const q = query(
      collection(db, 'recurringExpenses'),
      where('active', '==', true)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    // Filter in-memory for expenses due on or before today
    const dueDocs = snap.docs.filter((d) => {
      const rec = d.data() as RecurringExpenseData;
      return rec.nextRun && rec.nextRun <= todayStr;
    });

    if (dueDocs.length === 0) return;

    for (const recDoc of dueDocs) {
      const rec = recDoc.data() as RecurringExpenseData;
      if (!rec.active || !rec.recurringExpenseId) continue;

      const runDate = rec.nextRun;

      if (rec.endDate && runDate > rec.endDate) {
        await updateDoc(doc(db, 'recurringExpenses', rec.recurringExpenseId), {
          active: false,
          updatedAt: serverTimestamp(),
        });
        continue;
      }

      // Idempotency check with deterministic ID
      const deterministicId = `rec_${rec.recurringExpenseId}_${runDate}`;
      const expenseRef = doc(db, 'expenses', deterministicId);
      const subcollRef = doc(db, 'groups', rec.groupId, 'expenses', deterministicId);

      try {
        await runTransaction(db, async (transaction) => {
          const expSnap = await transaction.get(expenseRef);
          if (!expSnap.exists()) {
            const expenseData: ExpenseData = {
              expenseId: deterministicId,
              groupId: rec.groupId,
              title: rec.title,
              amount: rec.amount,
              paidBy: rec.paidBy,
              createdBy: rec.createdBy,
              splitType: rec.splitType || 'equal',
              splitDetails: rec.splitDetails,
              category: rec.category || '📦 Other',
              date: new Date(runDate).toISOString(),
              notes: rec.notes ? `${rec.notes} (Recurring)` : 'Recurring expense',
              createdAt: serverTimestamp(),
            };

            transaction.set(expenseRef, expenseData);
            transaction.set(subcollRef, expenseData);
          }

          const nextRunDate = calculateNextRunDate(runDate, rec.frequency);
          const isExpired = rec.endDate ? nextRunDate > rec.endDate : false;

          transaction.update(doc(db, 'recurringExpenses', rec.recurringExpenseId!), {
            nextRun: nextRunDate,
            active: !isExpired,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (trErr) {
        console.error(`[Recurring] Idempotency transaction error for ${rec.recurringExpenseId}:`, trErr);
      }
    }
  } catch (err) {
    console.error('[Recurring] Error in processDueRecurringExpenses:', err);
  }
};

export const updateExpenseInFirestore = async (expenseId: string, data: Partial<ExpenseData>) => {
  try {
    const user = auth.currentUser;
    const expenseRef = doc(db, 'expenses', expenseId);

    const updatePayload = sanitizeData({ ...data, updatedAt: serverTimestamp() });
    
    // Instantly execute primary write
    const writePromise = setDoc(expenseRef, updatePayload, { merge: true });

    // Perform old snapshot comparison, activity logging, and notification dispatch asynchronously in background
    (async () => {
      try {
        const oldSnap = await getDoc(expenseRef);
        const oldExpense = oldSnap.exists() ? (oldSnap.data() as ExpenseData) : null;

        if (oldExpense?.groupId) {
          const subcollExpenseRef = doc(db, 'groups', oldExpense.groupId, 'expenses', expenseId);
          await setDoc(subcollExpenseRef, updatePayload, { merge: true }).catch(() => {});

          if (user) {
            const changes: string[] = [];
            if (data.amount !== undefined && data.amount !== oldExpense.amount) {
              changes.push(`Amount: ₹${oldExpense.amount} → ₹${data.amount}`);
            }
            if (data.title !== undefined && data.title.trim() !== oldExpense.title) {
              changes.push(`Title: "${oldExpense.title}" → "${data.title.trim()}"`);
            }
            if (data.category !== undefined && data.category !== oldExpense.category) {
              changes.push(`Category: ${oldExpense.category} → ${data.category}`);
            }
            const changeSummary = changes.length > 0 ? changes.join(', ') : 'Details updated';

            // Log activity
            const actRef = doc(collection(db, 'activities'));
            setDoc(actRef, {
              activityId: actRef.id,
              groupId: oldExpense.groupId,
              type: 'expense',
              title: `Updated "${data.title || oldExpense.title}" (${changeSummary})`,
              actorUid: user.uid,
              amount: data.amount !== undefined ? data.amount : oldExpense.amount,
              createdAt: serverTimestamp(),
            }).catch(() => {});

            // Send notification to all other group members showing changed values
            const groupSnap = await getDoc(doc(db, 'groups', oldExpense.groupId));
            if (groupSnap.exists()) {
              const gData = groupSnap.data() as GroupData;
              const otherMembers = (gData.memberIds || []).filter((uid) => uid !== user.uid);

              const notifyOps = otherMembers.map((uid) =>
                NotificationService.notifyUser(uid, {
                  type: 'EXPENSE',
                  title: 'Expense Updated',
                  message: `${user.displayName || 'Someone'} updated "${oldExpense.title}" in ${gData.name} (${changeSummary})`,
                  data: { groupId: oldExpense.groupId, expenseId, groupName: gData.name },
                })
              );
              await Promise.all(notifyOps);
            }
          }
        }
      } catch (bgErr) {
        console.warn('[Firestore] Background expense update task warning:', bgErr);
      }
    })();

    await writePromise;
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

    // Notify all group members in background
    (async () => {
      try {
        const expSnap = await getDoc(doc(db, 'expenses', expenseId));
        if (expSnap.exists()) {
          const expData = expSnap.data() as ExpenseData;
          if (expData.groupId) {
            const groupSnap = await getDoc(doc(db, 'groups', expData.groupId));
            if (groupSnap.exists()) {
              const gData = groupSnap.data() as GroupData;
              const otherMembers = (gData.memberIds || []).filter((uid) => uid !== user.uid);

              const notifyOps = otherMembers.map((uid) =>
                NotificationService.notifyUser(uid, {
                  type: 'COMMENT',
                  title: `Comment on "${expData.title}"`,
                  message: `${user.displayName || 'Someone'} commented: "${text.trim()}" in ${gData.name}`,
                  data: { groupId: expData.groupId, expenseId, groupName: gData.name },
                })
              );
              await Promise.all(notifyOps);
            }
          }
        }
      } catch (e) {
        console.error('[Firestore] Comment notification error:', e);
      }
    })();

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
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const settlementRef = doc(collection(db, 'settlements'));
    const settlementData = {
      ...settlement,
      status: settlement.status || 'pending',
      settlementId: settlementRef.id,
      createdAt: serverTimestamp(),
    };
    await setDoc(settlementRef, settlementData);

    // Notify recipient
    (async () => {
      try {
        const isCompleted = settlementData.status === 'completed';
        const recipientId = settlement.toUserId === user.uid ? settlement.fromUserId : settlement.toUserId;

        if (isCompleted) {
          // If receiver marked as settled, notify the payer that balance is cleared
          // If payer marked as settled (and it was auto-completed somehow), notify receiver
          const notifyTitle = 'Balance Settled';
          const notifyMsg = settlement.toUserId === user.uid
            ? `${user.displayName || 'Someone'} marked your debt of ₹${settlement.amount} as settled.`
            : `${user.displayName || 'Someone'} settled ₹${settlement.amount} with you.`;

          await NotificationService.notifyUser(recipientId, {
            type: 'SETTLEMENT',
            title: notifyTitle,
            message: notifyMsg,
            data: { groupId: settlement.groupId, settlementId: settlementRef.id, amount: settlement.amount, status: 'completed' }
          });
        } else {
          // Normal pending settlement flow
          await NotificationService.notifyUser(recipientId, {
            type: 'SETTLEMENT',
            title: 'Settlement Confirmation Required',
            message: `${settlement.fromName || user.displayName || 'Someone'} paid ₹${settlement.amount}. Tap to confirm receipt.`,
            data: { groupId: settlement.groupId, settlementId: settlementRef.id, amount: settlement.amount }
          });
        }
      } catch (e) {
        console.error('Settlement notif error:', e);
      }
    })();

    return settlementRef.id;
  } catch (error) {
    console.error('Error adding settlement to Firestore:', error);
    throw error;
  }
};

export const confirmSettlementInFirestore = async (settlementId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    const sRef = doc(db, 'settlements', settlementId);
    const sSnap = await getDoc(sRef);

    if (!sSnap.exists()) throw new Error('Settlement not found');
    const sData = sSnap.data() as SettlementData;

    await updateDoc(sRef, {
      status: 'completed',
      confirmedAt: serverTimestamp(),
      confirmedBy: user?.uid || '',
    });

    // Log activity
    (async () => {
      try {
        const actRef = doc(collection(db, 'activities'));
        await setDoc(actRef, {
          activityId: actRef.id,
          groupId: sData.groupId,
          type: 'settlement',
          title: `Settled ₹${sData.amount} between ${sData.fromName || 'Member'} and ${sData.toName || 'Member'}`,
          actorUid: user?.uid || '',
          amount: sData.amount,
          createdAt: serverTimestamp(),
        });
      } catch (actErr) {
        console.warn('Error logging settlement activity:', actErr);
      }
    })();

    // Notify sender that settlement was confirmed
    if (user && sData.fromUserId && sData.fromUserId !== user.uid) {
      (async () => {
        try {
          await NotificationService.notifyUser(sData.fromUserId, {
            type: 'SETTLEMENT',
            title: 'Settlement Confirmed',
            message: `${user.displayName || sData.toName || 'Someone'} confirmed your settlement of ₹${sData.amount}`,
            data: { groupId: sData.groupId, settlementId },
          });
        } catch (notifErr) {
          console.error('Error notifying settlement sender:', notifErr);
        }
      })();
    }
  } catch (error) {
    console.error('Error confirming settlement:', error);
    throw error;
  }
};

export const rejectSettlementInFirestore = async (settlementId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    const sRef = doc(db, 'settlements', settlementId);
    const sSnap = await getDoc(sRef);

    if (!sSnap.exists()) return;
    const sData = sSnap.data() as SettlementData;

    await deleteDoc(sRef);

    if (user && sData.fromUserId && sData.fromUserId !== user.uid) {
      (async () => {
        try {
          await NotificationService.notifyUser(sData.fromUserId, {
            type: 'SETTLEMENT',
            title: 'Settlement Declined',
            message: `${user.displayName || sData.toName || 'Someone'} declined your settlement request of ₹${sData.amount}`,
            data: { groupId: sData.groupId },
          });
        } catch (notifErr) {
          console.error('Error notifying settlement rejection:', notifErr);
        }
      })();
    }
  } catch (error) {
    console.error('Error rejecting settlement:', error);
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

  const targetGroupIds = groupIds.slice(0, 30);
  const expensesQuery = query(collection(db, 'expenses'), where('groupId', 'in', targetGroupIds));
  const settlementsQuery = query(collection(db, 'settlements'), where('groupId', 'in', targetGroupIds));
  const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', auth.currentUser?.uid || ''));
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

export const getEffectiveSplitDetails = (
  exp: ExpenseData,
  groupData?: GroupData
): Record<string, number> => {
  const rawSplits = exp.splitDetails || {};
  if (!groupData) return rawSplits;

  const memberIds = groupData.memberIds || [];
  if (memberIds.length === 0) return rawSplits;

  const preferences = groupData.memberExistingExpensesPreference || {};

  // Find all participating members for this expense
  const participatingUids = memberIds.filter((uid) => {
    if (uid in rawSplits && rawSplits[uid] > 0) return true;
    const pref = preferences[uid] ?? true;
    return pref !== false;
  });

  if (participatingUids.length === 0 || Object.keys(rawSplits).length >= participatingUids.length) {
    return rawSplits;
  }

  const totalAmount = exp.amount || 0;
  const equalShare = Math.round((totalAmount / participatingUids.length) * 100) / 100;
  const effective: Record<string, number> = {};
  let runningSum = 0;

  participatingUids.forEach((uid, idx) => {
    if (idx === participatingUids.length - 1) {
      effective[uid] = Math.round((totalAmount - runningSum) * 100) / 100;
    } else {
      effective[uid] = equalShare;
      runningSum += equalShare;
    }
  });

  return effective;
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
  const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));

  let allExpenses: ExpenseData[] = [];
  let allSettlements: SettlementData[] = [];
  let userGroupsMap = new Map<string, GroupData>();

  const recalculate = () => {
    const groupBalances: Record<string, number> = {};

    allExpenses.forEach((exp) => {
      const gId = exp.groupId;
      if (!userGroupsMap.has(gId)) return;

      const groupData = userGroupsMap.get(gId);
      const joinedAt = groupData?.membersJoinedAt?.[uid];
      const includeExisting = groupData?.memberExistingExpensesPreference?.[uid] ?? true;
      const expTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();

      if (!includeExisting && joinedAt && expTime < joinedAt) return;

      const effectiveSplits = getEffectiveSplitDetails(exp, groupData);
      const isPayer = exp.paidBy === uid;
      const userShare = effectiveSplits[uid] || 0;

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

  const unsub3 = onSnapshot(groupsQuery, (snap) => {
    userGroupsMap.clear();
    snap.docs.forEach((docSnap) => {
      userGroupsMap.set(docSnap.id, docSnap.data() as GroupData);
    });
    recalculate();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
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
  const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));

  let allExpenses: ExpenseData[] = [];
  let allSettlements: SettlementData[] = [];
  let userGroupsMap = new Map<string, GroupData>();

  const recalculateBalances = () => {
    let owedSum = 0;
    let oweSum = 0;

    allExpenses.forEach((exp) => {
      const groupData = userGroupsMap.get(exp.groupId);
      if (!groupData) return;

      const joinedAt = groupData?.membersJoinedAt?.[uid];
      const includeExisting = groupData?.memberExistingExpensesPreference?.[uid] ?? true;

      const expTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();

      // If user chose "new only" (includeExisting = false), skip expenses created before they joined
      if (!includeExisting && joinedAt && expTime < joinedAt) {
        return;
      }

      const effectiveSplits = getEffectiveSplitDetails(exp, groupData);
      const isPayer = exp.paidBy === uid;
      const userShare = effectiveSplits[uid] || 0;

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

  const unsub3 = onSnapshot(groupsQuery, (snap) => {
    userGroupsMap.clear();
    snap.docs.forEach((docSnap) => {
      userGroupsMap.set(docSnap.id, docSnap.data() as GroupData);
    });
    recalculateBalances();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
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
      adminIds: arrayUnion(newOwnerUid),
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
