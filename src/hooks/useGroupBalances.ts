import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToGroupExpenses,
  subscribeToGroupSettlements,
  ExpenseData,
  SettlementData
} from '../services/firestoreService';

export interface GroupBalanceSummary {
  totalSpent: number;
  netBalance: number;
  loading: boolean;
}

export const useGroupBalances = (groupId: string, currentUid: string) => {
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const unsubExpenses = subscribeToGroupExpenses(groupId, (expList) => {
      setExpenses(expList);
    });

    const unsubSettlements = subscribeToGroupSettlements(groupId, (setList) => {
      setSettlements(setList);
      setLoading(false);
    });

    return () => {
      unsubExpenses();
      unsubSettlements();
    };
  }, [groupId]);

  const summary = useMemo(() => {
    let totalSpent = 0;
    let netBalance = 0;

    expenses.forEach((exp) => {
      const amount = exp.amount || 0;
      totalSpent += amount;

      const isPayer = exp.paidBy === currentUid;
      const splitDetails = exp.splitDetails || {};
      const myShare = splitDetails[currentUid] !== undefined ? splitDetails[currentUid] : 0;

      if (isPayer) {
        // I paid, others owe me (total - my share)
        netBalance += (amount - myShare);
      } else {
        // Someone else paid, I owe them my share
        netBalance -= myShare;
      }
    });

    settlements.forEach((set) => {
      const amount = set.amount || 0;
      if (set.fromUserId === currentUid) {
        // I paid off a debt, net balance increases towards 0
        netBalance += amount;
      } else if (set.toUserId === currentUid) {
        // Someone paid me, net balance decreases towards 0
        netBalance -= amount;
      }
    });

    return {
      totalSpent,
      netBalance: Math.round(netBalance * 100) / 100, // Round to 2 decimal places
    };
  }, [expenses, settlements, currentUid]);

  return {
    ...summary,
    loading,
    expenses, // Also return expenses to avoid duplicate listeners in the screen
  };
};
