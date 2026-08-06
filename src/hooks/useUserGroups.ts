import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import {
  subscribeToUserGroups,
  subscribeUserGroupBalances,
  GroupData,
} from '../services/firestoreService';

export function useUserGroups() {
  const currentUser = auth.currentUser;
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubGroups = subscribeToUserGroups(currentUser.uid, (groupList) => {
      setGroups(groupList);
      setLoading(false);
    });

    const unsubGroupBalances = subscribeUserGroupBalances(currentUser.uid, (balances) => {
      setGroupBalances(balances);
    });

    return () => {
      unsubGroups();
      unsubGroupBalances();
    };
  }, [currentUser]);

  const refreshGroups = () => {
    // In a real app with pull-to-refresh, you might re-fetch.
    // With Firestore onSnapshot, it's mostly automatic, but we can toggle loading for UX.
    setLoading(true);
    // The snapshot will trigger again if there's a change or re-sync
  };

  return {
    groups,
    groupBalances,
    loading,
    refreshGroups,
    currentUser,
  };
}
