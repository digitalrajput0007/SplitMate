import { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { GroupData, ExpenseData, SettlementData } from '../services/firestoreService';
import { useUserGroups } from './useUserGroups';

export interface GroupPairwiseBalance {
  group: GroupData;
  balance: number; // positive = contact owes me, negative = I owe contact
}

export interface PairwiseBalanceSummary {
  totalBalance: number; // positive = contact owes me, negative = I owe contact
  groupBreakdown: GroupPairwiseBalance[];
}

export function usePairwiseBalances() {
  const currentUser = auth.currentUser;
  const myUid = currentUser?.uid;
  const { allGroups } = useUserGroups();

  const [balancesMap, setBalancesMap] = useState<Map<string, PairwiseBalanceSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid || allGroups.length === 0) {
      setBalancesMap(new Map());
      setLoading(false);
      return;
    }

    const groupUnsubs: (() => void)[] = [];
    const groupDataMap: Record<string, { expenses: ExpenseData[]; settlements: SettlementData[] }> = {};

    const updateAllBalances = () => {
      const newMap = new Map<string, PairwiseBalanceSummary>();

      allGroups.forEach((group) => {
        const gId = group.groupId;
        const gData = groupDataMap[gId];
        if (!gData) return;

        const members = group.memberIds || [];
        const memberCount = members.length || 1;
        const expenses = gData.expenses;
        const settlements = gData.settlements;

        // Calculate pairwise balance with each member in this group
        members.forEach((otherUid) => {
          if (otherUid === myUid) return;

          let groupBal = 0;

          // 1. Expense splits
          expenses.forEach((exp) => {
            const amt = exp.amount || 0;
            const paidBy = exp.paidBy;
            const splits = exp.splitDetails || {};

            const myShare = splits[myUid] !== undefined ? splits[myUid] : amt / memberCount;
            const otherShare = splits[otherUid] !== undefined ? splits[otherUid] : amt / memberCount;

            if (paidBy === myUid) {
              groupBal += otherShare;
            } else if (paidBy === otherUid) {
              groupBal -= myShare;
            }
          });

          // 2. Completed settlements
          settlements.forEach((s) => {
            if (s.status === 'completed') {
              if (s.fromUserId === myUid && s.toUserId === otherUid) {
                groupBal += s.amount;
              } else if (s.fromUserId === otherUid && s.toUserId === myUid) {
                groupBal -= s.amount;
              }
            }
          });

          // Store in summary map
          const existing = newMap.get(otherUid) || { totalBalance: 0, groupBreakdown: [] };
          const updatedBreakdown = [...existing.groupBreakdown, { group, balance: groupBal }];
          newMap.set(otherUid, {
            totalBalance: existing.totalBalance + groupBal,
            groupBreakdown: updatedBreakdown,
          });
        });
      });

      setBalancesMap(newMap);
      setLoading(false);
    };

    allGroups.forEach((group) => {
      const gId = group.groupId;
      groupDataMap[gId] = { expenses: [], settlements: [] };

      // Expenses snapshot
      const expQuery = query(collection(db, 'expenses'), where('groupId', '==', gId));
      const unsubExp = onSnapshot(expQuery, (snap) => {
        groupDataMap[gId].expenses = snap.docs.map((d) => d.data() as ExpenseData);
        updateAllBalances();
      });

      // Settlements snapshot
      const setQuery = query(collection(db, 'settlements'), where('groupId', '==', gId));
      const unsubSet = onSnapshot(setQuery, (snap) => {
        groupDataMap[gId].settlements = snap.docs.map((d) => d.data() as SettlementData);
        updateAllBalances();
      });

      groupUnsubs.push(unsubExp, unsubSet);
    });

    return () => {
      groupUnsubs.forEach((u) => u());
    };
  }, [myUid, allGroups]);

  return { balancesMap, loading };
}
