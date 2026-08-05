import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  paymentHandle?: string;
  dob?: string;
  mobile?: string;
  preferredCurrency?: string;
  preferences?: {
    expenseAlerts?: boolean;
    settlementReminders?: boolean;
    monthlyDigest?: boolean;
    currency?: string;
    theme?: string;
    language?: string;
  };
  createdAt?: any;
}

export interface GroupMemberProfile {
  uid: string;
  name: string;
  email?: string;
  photoUrl?: string;
  role?: 'Admin' | 'Member';
}

export interface GroupData {
  groupId: string;
  name: string;
  category?: 'Travel' | 'Food' | 'Rent' | 'Event' | 'Utilities' | 'Other';
  groupType?: 'Trip' | 'Home' | 'Couple' | 'Other';
  enableDates?: boolean;
  startDate?: string;
  endDate?: string;
  memberIds: string[];
  members?: Array<{ name: string; email?: string }>;
  memberProfiles?: Record<string, GroupMemberProfile>;
  createdBy: string;
  createdAt: any;
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
  splitType: 'equal' | 'exact' | 'percentage';
  splitDetails: Record<string, number>;
  category: string;
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
      name: profile.name || profile.email?.split('@')[0] || 'User',
      email: profile.email || '',
      photoUrl: profile.photoUrl || '',
      paymentHandle: profile.paymentHandle || '',
      dob: profile.dob || '',
      mobile: profile.mobile || '',
      preferredCurrency: profile.preferredCurrency || 'INR',
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      dataToSave.createdAt = serverTimestamp();
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
    groupType?: 'Trip' | 'Home' | 'Couple' | 'Other';
    enableDates?: boolean;
    startDate?: string;
    endDate?: string;
  }
): Promise<string> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const allMemberIds = Array.from(new Set([currentUser.uid, ...memberIds]));

    const groupRef = doc(collection(db, 'groups'));
    const groupData: GroupData = {
      groupId: groupRef.id,
      name: name.trim(),
      memberIds: allMemberIds,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      ...(extraDetails?.groupType && { groupType: extraDetails.groupType }),
      ...(extraDetails?.enableDates !== undefined && { enableDates: extraDetails.enableDates }),
      ...(extraDetails?.startDate && { startDate: extraDetails.startDate }),
      ...(extraDetails?.endDate && { endDate: extraDetails.endDate }),
    };

    await setDoc(groupRef, groupData);
    return groupRef.id;
  } catch (error) {
    console.error('Error creating group in Firestore:', error);
    throw error;
  }
};

export const updateGroupInFirestore = async (groupId: string, data: Partial<GroupData>) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
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

export const subscribeToUserGroups = (
  uid: string,
  onGroupsUpdate: (groups: GroupData[]) => void
) => {
  const groupsQuery = query(
    collection(db, 'groups'),
    where('memberIds', 'array-contains', uid)
  );

  return onSnapshot(
    groupsQuery,
    (snapshot) => {
      const groups: GroupData[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          groupId: docSnap.id,
          name: data.name || 'Unnamed Group',
          memberIds: data.memberIds || [],
          createdBy: data.createdBy || '',
          createdAt: data.createdAt,
          balanceLabel: 'settled',
          balanceAmount: '₹0',
        };
      });

      onGroupsUpdate(groups);
    },
    (error) => {
      console.error('Error listening to groups:', error);
    }
  );
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

// -------------------------------------------------------------
// EXPENSES COLLECTION
// -------------------------------------------------------------
export const addExpenseToFirestore = async (expense: Omit<ExpenseData, 'expenseId' | 'createdAt'>): Promise<string> => {
  try {
    const expenseRef = doc(collection(db, 'expenses'));
    const expenseData = {
      ...expense,
      expenseId: expenseRef.id,
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

  // Filter in memory across expenses
  const expensesQuery = query(collection(db, 'expenses'));
  const settlementsQuery = query(collection(db, 'settlements'));

  let currentExpenses: ExpenseData[] = [];
  let currentSettlements: SettlementData[] = [];

  const mergeAndNotify = () => {
    const items: ActivityItem[] = [];

    currentExpenses.forEach((exp) => {
      if (groupIds.includes(exp.groupId)) {
        const rawTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();
        const formattedDate = new Date(rawTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        items.push({
          id: exp.expenseId || Math.random().toString(),
          type: 'expense',
          title: exp.title,
          subtitle: `Added in ${exp.groupName || 'Group'}`,
          amount: exp.amount,
          category: exp.category,
          groupName: exp.groupName,
          date: formattedDate,
          rawTimestamp: rawTime,
        });
      }
    });

    currentSettlements.forEach((set) => {
      if (groupIds.includes(set.groupId)) {
        const rawTime = set.createdAt?.seconds ? set.createdAt.seconds * 1000 : Date.now();
        const formattedDate = new Date(rawTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        items.push({
          id: set.settlementId || Math.random().toString(),
          type: 'settlement',
          title: `Settlement Completed`,
          subtitle: `Payment of ${set.amount} recorded`,
          amount: set.amount,
          category: '💸',
          date: formattedDate,
          rawTimestamp: rawTime,
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

  const recalculateBalances = () => {
    let owedSum = 0;
    let oweSum = 0;

    allExpenses.forEach((exp) => {
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

    const netBalance = owedSum - oweSum;

    onSummaryUpdate({
      totalBalance: netBalance,
      youAreOwed: owedSum,
      youOwe: oweSum,
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
