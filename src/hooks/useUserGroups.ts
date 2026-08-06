import { useState, useEffect, useMemo } from 'react';
import { auth } from '../config/firebase';
import {
  subscribeToUserGroups,
  subscribeUserGroupBalances,
  GroupData,
} from '../services/firestoreService';

export function useUserGroups() {
  const currentUser = auth.currentUser;
  const [allGroups, setAllGroups] = useState<GroupData[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubGroups = subscribeToUserGroups(currentUser.uid, (groupList) => {
      setAllGroups(groupList);
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

  const activeGroups = useMemo(() => {
    return allGroups.filter(g => !g.isArchived);
  }, [allGroups]);

  const archivedGroups = useMemo(() => {
    return allGroups.filter(g => g.isArchived);
  }, [allGroups]);

  const refreshGroups = () => {
    setLoading(true);
  };

  return {
    groups: activeGroups, // Default to active groups for backward compatibility
    activeGroups,
    archivedGroups,
    allGroups,
    groupBalances,
    loading,
    refreshGroups,
    currentUser,
  };
}
