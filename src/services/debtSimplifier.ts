import { ExpenseData, SettlementData } from './firestoreService';

export interface SimplifiedDebt {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toPaymentHandle: string;
  amount: number;
}

export const simplifyDebts = (
  expenses: ExpenseData[],
  settlements: SettlementData[],
  memberProfiles: Record<string, { name: string; paymentHandle?: string }>
): SimplifiedDebt[] => {
  // Step 1: Calculate net balance for every member
  const netBalances: Record<string, number> = {};

  // Initialize all known members to 0
  Object.keys(memberProfiles).forEach((uid) => {
    netBalances[uid] = 0;
  });

  // Accumulate expense balances
  expenses.forEach((exp) => {
    const payer = exp.paidBy;
    const totalAmount = exp.amount;
    const splitDetails = exp.splitDetails || {};

    if (!(payer in netBalances)) netBalances[payer] = 0;
    netBalances[payer] += totalAmount;

    Object.entries(splitDetails).forEach(([memberId, share]) => {
      if (!(memberId in netBalances)) netBalances[memberId] = 0;
      netBalances[memberId] -= share;
    });
  });

  // Accumulate completed settlements
  settlements.forEach((s) => {
    if (s.status === 'completed' || !s.status) {
      const from = s.fromUserId;
      const to = s.toUserId;
      if (!(from in netBalances)) netBalances[from] = 0;
      if (!(to in netBalances)) netBalances[to] = 0;

      netBalances[from] += s.amount;
      netBalances[to] -= s.amount;
    }
  });

  // Separate members into debtors (< 0) and creditors (> 0)
  const debtors: { uid: string; amount: number }[] = [];
  const creditors: { uid: string; amount: number }[] = [];

  Object.entries(netBalances).forEach(([uid, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ uid, amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ uid, amount: rounded });
    }
  });

  // Sort descending by amount for optimal greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplified: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (settleAmount > 0.01) {
      const fromName = memberProfiles[debtor.uid]?.name || (debtor.uid.includes('current') ? 'You' : 'Member');
      const toProfile = memberProfiles[creditor.uid] || { name: 'Member', paymentHandle: '' };
      const toName = toProfile.name || 'Member';
      const toHandle = toProfile.paymentHandle || `${toName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`;

      simplified.push({
        id: `debt_${debtor.uid}_${creditor.uid}_${simplified.length}`,
        fromUserId: debtor.uid,
        fromName: fromName,
        toUserId: creditor.uid,
        toName: toName,
        toPaymentHandle: toHandle,
        amount: settleAmount,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return simplified;
};
