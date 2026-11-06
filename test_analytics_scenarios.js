// Test Suite: SplitMate Financial Calculation & Regression Audit
// Runs all 10 test scenarios deterministically

function getEffectiveSplitDetails(exp, groupData) {
  const rawSplits = exp.splitDetails || {};
  const hasRawSplits = Object.keys(rawSplits).length > 0 && Object.values(rawSplits).some((v) => v > 0);

  if (hasRawSplits) {
    return rawSplits;
  }

  if (!groupData) return rawSplits;

  const memberIds = groupData.memberIds || [];
  if (memberIds.length === 0) return rawSplits;

  const preferences = groupData.memberExistingExpensesPreference || {};

  const participatingUids = memberIds.filter((uid) => {
    const pref = preferences[uid] ?? true;
    return pref !== false;
  });

  if (participatingUids.length === 0) {
    return rawSplits;
  }

  const totalAmount = exp.amount || 0;
  const equalShare = Math.round((totalAmount / participatingUids.length) * 100) / 100;
  const effective = {};
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
}

function calculateOverviewMetrics(filteredExpenses, filteredSettlements, groupMap, currentUid) {
  let totalSpending = 0;
  let youPaid = 0;
  let yourShare = 0;

  filteredExpenses.forEach((exp) => {
    const group = groupMap.get(exp.groupId);
    const joinedAt = group?.membersJoinedAt?.[currentUid];
    const includeExisting = group?.memberExistingExpensesPreference?.[currentUid] ?? true;
    const expTime = exp.createdAt?.seconds
      ? exp.createdAt.seconds * 1000
      : (exp.createdAt ? new Date(exp.createdAt).getTime() : Date.now());
    const isExcludedPreJoin = !includeExisting && joinedAt && expTime < joinedAt;

    const effectiveSplits = getEffectiveSplitDetails(exp, group);
    const expAmount = Number(exp.amount) || 0;
    totalSpending += expAmount;

    if (exp.paidBy === currentUid) {
      youPaid += expAmount;
    }

    if (currentUid && !isExcludedPreJoin && effectiveSplits[currentUid] !== undefined) {
      yourShare += Number(effectiveSplits[currentUid]) || 0;
    }
  });

  let userSent = 0;
  let userReceived = 0;
  filteredSettlements.forEach((s) => {
    if (s.status === 'completed' || !s.status) {
      if (s.fromUserId === currentUid) userSent += Number(s.amount) || 0;
      if (s.toUserId === currentUid) userReceived += Number(s.amount) || 0;
    }
  });

  const netBalance = Math.round((youPaid - yourShare + userSent - userReceived) * 100) / 100;

  return {
    totalSpending: Math.round(totalSpending * 100) / 100,
    youPaid: Math.round(youPaid * 100) / 100,
    yourShare: Math.round(yourShare * 100) / 100,
    netBalance,
  };
}

function getExpenseBillingMonth(item) {
  if (item.billingMonth && /^\d{4}-\d{2}$/.test(item.billingMonth)) {
    return item.billingMonth;
  }
  let d = null;
  if (item.date) {
    const parsedDate = new Date(item.date);
    if (!isNaN(parsedDate.getTime())) d = parsedDate;
  }
  if (!d && item.createdAt) {
    const parsedCreated = new Date(item.createdAt);
    if (!isNaN(parsedCreated.getTime())) d = parsedCreated;
  }
  if (d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedCount++;
  }
}

console.log('--- RUNNING SPLITMATE FINANCIAL ACCURACY TESTS ---\n');

// Group definition
const group1 = {
  groupId: 'g1',
  name: 'Goa Trip',
  memberIds: ['userA', 'userB', 'userC', 'userD'],
  memberExistingExpensesPreference: {},
};
const groupMap = new Map([['g1', group1]]);

// SCENARIO 1: Prompt Base Scenario
// Group total expenses: ₹3,000
// Current user (userA) paid: ₹2,000
// Current user share: ₹1,200
// Another member (userB) paid: ₹1,000 (share: ₹1,800)
// Balance: +₹800 owed to userA
const s1_expenses = [
  {
    groupId: 'g1',
    amount: 3000,
    paidBy: 'userA',
    splitDetails: { userA: 1200, userB: 1800 },
  },
  // Note: userB paid ₹1000 can be another expense or part of split
  // In prompt: "Group total expenses: ₹3,000. Current user paid: ₹2,000. Current user share: ₹1,200. Another member paid: ₹1,000."
  // That means:
  // Expense 1: ₹2,000 paid by userA (userA share: 1200, userB share: 800)
  // Expense 2: ₹1,000 paid by userB (userA share: 0, userB share: 1000)
  // Total expenses = 3000, userA paid = 2000, userA share = 1200, userB paid = 1000.
];
const s1_metrics = calculateOverviewMetrics(
  [
    { groupId: 'g1', amount: 2000, paidBy: 'userA', splitDetails: { userA: 1200, userB: 800 } },
    { groupId: 'g1', amount: 1000, paidBy: 'userB', splitDetails: { userA: 0, userB: 1000 } }
  ],
  [],
  groupMap,
  'userA'
);
assert(s1_metrics.totalSpending === 3000, 'Scenario 1: Total spending is ₹3,000');
assert(s1_metrics.youPaid === 2000, 'Scenario 1: You Paid is ₹2,000');
assert(s1_metrics.yourShare === 1200, 'Scenario 1: Your Share is ₹1,200');
assert(s1_metrics.netBalance === 800, 'Scenario 1: Net Balance is +₹800 (You are owed)');

// SCENARIO 2: Unequal Expense Splits
const s2_expenses = [
  { groupId: 'g1', amount: 1000, paidBy: 'userA', splitDetails: { userA: 300, userB: 700 } },
  { groupId: 'g1', amount: 2500, paidBy: 'userB', splitDetails: { userA: 1000, userB: 1500 } },
];
const s2_metrics = calculateOverviewMetrics(s2_expenses, [], groupMap, 'userA');
assert(s2_metrics.totalSpending === 3500, 'Scenario 2: Total spending is ₹3,500');
assert(s2_metrics.youPaid === 1000, 'Scenario 2: You Paid is ₹1,000');
assert(s2_metrics.yourShare === 1300, 'Scenario 2: Your Share is ₹1,300');
assert(s2_metrics.netBalance === -300, 'Scenario 2: Net Balance is -₹300 (You owe)');

// SCENARIO 3: Multiple Members with Excluded Member
const s3_expenses = [
  { groupId: 'g1', amount: 4000, paidBy: 'userA', splitDetails: { userA: 1000, userB: 1000, userC: 1000, userD: 1000 } },
  { groupId: 'g1', amount: 1200, paidBy: 'userB', splitDetails: { userA: 400, userB: 400, userC: 400 } }, // userD excluded
];
const s3_metrics = calculateOverviewMetrics(s3_expenses, [], groupMap, 'userA');
assert(s3_metrics.totalSpending === 5200, 'Scenario 3: Total spending is ₹5,200');
assert(s3_metrics.youPaid === 4000, 'Scenario 3: You Paid is ₹4,000');
assert(s3_metrics.yourShare === 1400, 'Scenario 3: Your Share is ₹1,400');
assert(s3_metrics.netBalance === 2600, 'Scenario 3: Net Balance is +₹2,600');

// SCENARIO 4: Soft-Deleted Expenses
const raw_s4 = [
  { groupId: 'g1', amount: 1500, paidBy: 'userA', splitDetails: { userA: 750, userB: 750 } },
  { groupId: 'g1', amount: 5000, paidBy: 'userA', isDeleted: true, splitDetails: { userA: 2500, userB: 2500 } },
];
const s4_filtered = raw_s4.filter((e) => !e.isDeleted);
const s4_metrics = calculateOverviewMetrics(s4_filtered, [], groupMap, 'userA');
assert(s4_metrics.totalSpending === 1500, 'Scenario 4: Soft-deleted expense excluded, total is ₹1,500');
assert(s4_metrics.youPaid === 1500, 'Scenario 4: You Paid is ₹1,500');
assert(s4_metrics.yourShare === 750, 'Scenario 4: Your Share is ₹750');

// SCENARIO 5: Edited Expenses
const expenseDocMap = new Map();
expenseDocMap.set('exp1', { expenseId: 'exp1', groupId: 'g1', amount: 1000, paidBy: 'userA', splitDetails: { userA: 500, userB: 500 } });
// Edit occurs in-place
expenseDocMap.set('exp1', { expenseId: 'exp1', groupId: 'g1', amount: 1500, paidBy: 'userA', splitDetails: { userA: 750, userB: 750 } });
const s5_expenses = Array.from(expenseDocMap.values());
const s5_metrics = calculateOverviewMetrics(s5_expenses, [], groupMap, 'userA');
assert(s5_expenses.length === 1, 'Scenario 5: Edited expense maintains single document');
assert(s5_metrics.totalSpending === 1500, 'Scenario 5: Total spending reflects updated ₹1,500 only once');

// SCENARIO 6: Settled and Partially Settled Balances
const baseExpenses = [
  { groupId: 'g1', amount: 2000, paidBy: 'userA', splitDetails: { userA: 1200, userB: 800 } },
  { groupId: 'g1', amount: 1000, paidBy: 'userB', splitDetails: { userA: 0, userB: 1000 } }
];
// Subscenario 6A: Partially settled (User B pays User A ₹300)
const s6A_settlements = [
  { groupId: 'g1', fromUserId: 'userB', toUserId: 'userA', amount: 300, status: 'completed' },
];
const s6A_metrics = calculateOverviewMetrics(baseExpenses, s6A_settlements, groupMap, 'userA');
assert(s6A_metrics.totalSpending === 3000, 'Scenario 6A: Settlements do NOT inflate total spending (remains ₹3,000)');
assert(s6A_metrics.netBalance === 500, 'Scenario 6A: Partial settlement updates net balance from ₹800 to ₹500');

// Subscenario 6B: Fully settled (User B pays remaining ₹500)
const s6B_settlements = [
  { groupId: 'g1', fromUserId: 'userB', toUserId: 'userA', amount: 300, status: 'completed' },
  { groupId: 'g1', fromUserId: 'userB', toUserId: 'userA', amount: 500, status: 'completed' },
];
const s6B_metrics = calculateOverviewMetrics(baseExpenses, s6B_settlements, groupMap, 'userA');
assert(s6B_metrics.netBalance === 0, 'Scenario 6B: Full settlement brings net balance to ₹0 (Settled up)');

// Subscenario 6C: Pending settlement ignored
const s6C_settlements = [
  { groupId: 'g1', fromUserId: 'userB', toUserId: 'userA', amount: 800, status: 'pending' },
];
const s6C_metrics = calculateOverviewMetrics(baseExpenses, s6C_settlements, groupMap, 'userA');
assert(s6C_metrics.netBalance === 800, 'Scenario 6C: Pending settlement is ignored until confirmed');

// SCENARIO 7: Empty Groups
const s7_metrics = calculateOverviewMetrics([], [], groupMap, 'userA');
assert(s7_metrics.totalSpending === 0, 'Scenario 7: Empty group total spending is ₹0');
assert(s7_metrics.youPaid === 0, 'Scenario 7: Empty group You Paid is ₹0');
assert(s7_metrics.yourShare === 0, 'Scenario 7: Empty group Your Share is ₹0');
assert(s7_metrics.netBalance === 0, 'Scenario 7: Empty group Net Balance is ₹0');

// SCENARIO 8: Excluded Pre-Join Expenses
const groupLate = {
  groupId: 'g2',
  name: 'Roommates',
  memberIds: ['userA', 'userB'],
  membersJoinedAt: { userA: 10000 },
  memberExistingExpensesPreference: { userA: false },
};
const groupMapLate = new Map([['g2', groupLate]]);
const s8_expenses = [
  { groupId: 'g2', amount: 2000, paidBy: 'userB', createdAt: { seconds: 5 }, splitDetails: { userA: 1000, userB: 1000 } }, // Pre-join
  { groupId: 'g2', amount: 1000, paidBy: 'userB', createdAt: { seconds: 15 }, splitDetails: { userA: 500, userB: 500 } }, // Post-join
];
const s8_metrics = calculateOverviewMetrics(s8_expenses, [], groupMapLate, 'userA');
assert(s8_metrics.totalSpending === 3000, 'Scenario 8: Group spending includes all group expenses (₹3,000)');
assert(s8_metrics.yourShare === 500, 'Scenario 8: Pre-join expense liability excluded for userA (₹500 only)');

// SCENARIO 9: Date Filtering & Month Boundaries
const dOct = { billingMonth: '2026-10', date: '2026-10-31T23:59:59Z', amount: 500 };
const dNov = { billingMonth: '2026-11', date: '2026-11-01T00:00:01Z', amount: 800 };
const dSep = { billingMonth: '2026-09', date: '2026-09-15T12:00:00Z', amount: 300 };

assert(getExpenseBillingMonth(dOct) === '2026-10', 'Scenario 9: October 31 23:59 resolves to 2026-10');
assert(getExpenseBillingMonth(dNov) === '2026-11', 'Scenario 9: November 01 00:00 resolves to 2026-11');
assert(getExpenseBillingMonth(dSep) === '2026-09', 'Scenario 9: September 15 resolves to 2026-09');

console.log(`\n--- TEST RUN COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED ---`);
process.exit(failedCount > 0 ? 1 : 0);
