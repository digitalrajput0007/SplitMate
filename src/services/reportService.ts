/**
 * SplitMate – Financial Report Generation Service
 * Generates production-quality PDF and CSV reports for Personal and Group financial activity.
 * Reuses existing canonical calculations, date filtering, and split resolution.
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import { SPLITMATE_LOGO_BASE64 } from '../assets/logoBase64';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ExpenseData,
  GroupData,
  SettlementData,
  UserProfile,
  getEffectiveSplitDetails,
} from './firestoreService';
import {
  parseFirestoreDate,
  formatFirestoreDate,
  getExpenseBillingMonth,
  getCurrentBillingMonth,
  formatLocalDateToYMD,
} from '../utils/dateUtils';
import { formatCurrency } from './currencyService';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ReportScope = 'personal' | 'group';
export type ReportFormat = 'pdf' | 'csv';
export type ReportDateRangeType =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'all_time'
  | 'custom';

export interface ReportConfig {
  scope: ReportScope;
  format: ReportFormat;
  groupId?: string;
  dateRangeType: ReportDateRangeType;
  customStartDate?: Date;
  customEndDate?: Date;
}

export interface DateRangeInfo {
  label: string;
  startDateStr: string;
  endDateStr: string;
}

export interface PersonalReportData {
  user: {
    uid: string;
    name: string;
    email: string;
  };
  dateRange: DateRangeInfo;
  generatedAt: string;
  metrics: {
    totalPersonalShare: number;
    totalAmountPaid: number;
    netBalance: number;
    totalExpensesCount: number;
    settlementsSent: number;
    settlementsReceived: number;
  };
  monthlyBreakdown: {
    month: string;
    label: string;
    userPaid: number;
    userShare: number;
    net: number;
  }[];
  categoryBreakdown: {
    category: string;
    label: string;
    amount: number;
    percentage: number;
  }[];
  expenses: {
    id: string;
    date: string;
    title: string;
    category: string;
    groupName: string;
    totalAmount: number;
    paidByMe: number;
    myShare: number;
  }[];
  settlements: {
    id: string;
    date: string;
    counterparty: string;
    direction: 'SENT' | 'RECEIVED';
    amount: number;
    status: string;
  }[];
}

export interface GroupReportData {
  group: {
    id: string;
    name: string;
    memberCount: number;
    currency: string;
  };
  dateRange: DateRangeInfo;
  generatedAt: string;
  metrics: {
    totalGroupExpenses: number;
    expenseCount: number;
    totalSettlementsAmount: number;
    settlementCount: number;
  };
  memberBreakdown: {
    uid: string;
    name: string;
    amountPaid: number;
    expenseShare: number;
    netBalance: number;
    percentShare: number;
  }[];
  categoryBreakdown: {
    category: string;
    label: string;
    amount: number;
    percentage: number;
  }[];
  expenses: {
    id: string;
    date: string;
    title: string;
    category: string;
    paidByName: string;
    totalAmount: number;
    participantsCount: number;
    participantsSummary: string;
  }[];
  settlements: {
    id: string;
    date: string;
    fromName: string;
    toName: string;
    amount: number;
    status: string;
  }[];
}

// ============================================================================
// Helpers & Sanitizers
// ============================================================================

const CATEGORY_NAMES: Record<string, string> = {
  food: 'Food & Dining',
  travel: 'Travel & Transport',
  rent: 'Rent & Housing',
  fun: 'Entertainment',
  shopping: 'Shopping',
  health: 'Health & Medical',
  other: 'Other',
};

export function normalizeCategoryName(cat: string = ''): string {
  const clean = cat.toLowerCase().trim();
  if (clean.includes('food') || clean.includes('dining')) return CATEGORY_NAMES.food;
  if (clean.includes('travel') || clean.includes('cab') || clean.includes('trip')) return CATEGORY_NAMES.travel;
  if (clean.includes('rent') || clean.includes('stay') || clean.includes('house')) return CATEGORY_NAMES.rent;
  if (clean.includes('fun') || clean.includes('movie') || clean.includes('party')) return CATEGORY_NAMES.fun;
  if (clean.includes('shop') || clean.includes('grocer')) return CATEGORY_NAMES.shopping;
  if (clean.includes('health') || clean.includes('med')) return CATEGORY_NAMES.health;
  return CATEGORY_NAMES.other;
}

/**
 * Sanitizes cell values to prevent CSV formula injection (OWASP guideline).
 * Prepends single quote if cell begins with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Formula injection prevention
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}


const WIN_ANSI_ADDITIONAL_CODES = new Set([
  0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017D,
  0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178,
]);

/**
 * Sanitizes any string for safe rendering in StandardFonts (WinAnsi encoding).
 * Strips emojis, surrogate pairs, and non-WinAnsi characters, converting ₹ to Rs.
 * Prevents "WinAnsi cannot encode" crashes when user notes or titles contain emojis.
 */
export function cleanPdfText(text: any, fallback: string = ''): string {
  if (text === null || text === undefined) return fallback;
  const str = String(text).replace(/₹/g, 'Rs. ');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_ADDITIONAL_CODES.has(code)) {
      out += str[i];
    }
  }
  const trimmed = out.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 50);
}

// ============================================================================
// Date Range Resolution & Filtering
// ============================================================================

export function resolveDateRangeInfo(config: ReportConfig): DateRangeInfo {
  const now = new Date();

  switch (config.dateRangeType) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        label: `This Month (${start.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        startDateStr: formatLocalDateToYMD(start),
        endDateStr: formatLocalDateToYMD(end),
      };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        label: `Last Month (${start.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        startDateStr: formatLocalDateToYMD(start),
        endDateStr: formatLocalDateToYMD(end),
      };
    }
    case 'last_3_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        label: `Last 3 Months (${start.toLocaleString('en-IN', { month: 'short' })} - ${now.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        startDateStr: formatLocalDateToYMD(start),
        endDateStr: formatLocalDateToYMD(end),
      };
    }
    case 'last_6_months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        label: `Last 6 Months (${start.toLocaleString('en-IN', { month: 'short' })} - ${now.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        startDateStr: formatLocalDateToYMD(start),
        endDateStr: formatLocalDateToYMD(end),
      };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        label: `This Year (${now.getFullYear()})`,
        startDateStr: formatLocalDateToYMD(start),
        endDateStr: formatLocalDateToYMD(end),
      };
    }
    case 'custom': {
      const s = config.customStartDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const e = config.customEndDate || now;
      const sStr = formatLocalDateToYMD(s);
      const eStr = formatLocalDateToYMD(e);
      return {
        label: `Custom (${sStr} to ${eStr})`,
        startDateStr: sStr,
        endDateStr: eStr,
      };
    }
    case 'all_time':
    default: {
      return {
        label: 'All Time',
        startDateStr: 'Beginning',
        endDateStr: formatLocalDateToYMD(now),
      };
    }
  }
}

export function filterItemsByDateRange<T extends { date?: string; createdAt?: any; billingMonth?: string }>(
  items: T[],
  config: ReportConfig
): T[] {
  const now = new Date();
  const currentMonthKey = getCurrentBillingMonth();

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const monthsKeys: string[] = [];
  if (config.dateRangeType === 'last_3_months') {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  } else if (config.dateRangeType === 'last_6_months') {
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const thisYearPrefix = `${now.getFullYear()}-`;

  return items.filter((item) => {
    if (config.dateRangeType === 'all_time') return true;

    if (config.dateRangeType === 'custom') {
      const itemDate = parseFirestoreDate(item.createdAt, item.date);
      const s = config.customStartDate ? new Date(config.customStartDate) : new Date(0);
      s.setHours(0, 0, 0, 0);
      const e = config.customEndDate ? new Date(config.customEndDate) : new Date();
      e.setHours(23, 59, 59, 999);
      return itemDate >= s && itemDate <= e;
    }

    const bMonth = getExpenseBillingMonth(item);
    switch (config.dateRangeType) {
      case 'this_month':
        return bMonth === currentMonthKey;
      case 'last_month':
        return bMonth === lastMonthKey;
      case 'last_3_months':
      case 'last_6_months':
        return monthsKeys.includes(bMonth);
      case 'this_year':
        return bMonth.startsWith(thisYearPrefix);
      default:
        return true;
    }
  });
}

// ============================================================================
// Data Builder: Personal Financial Report
// ============================================================================

export function buildPersonalReportData(
  config: ReportConfig,
  allExpenses: ExpenseData[],
  allSettlements: SettlementData[],
  groups: GroupData[],
  currentUser: { uid: string; displayName?: string | null; email?: string | null },
  usersMap: Map<string, UserProfile>
): PersonalReportData {
  const currentUid = currentUser.uid;
  const dateRange = resolveDateRangeInfo(config);
  const groupMap = new Map<string, GroupData>();
  groups.forEach((g) => {
    if (g.groupId) groupMap.set(g.groupId, g);
  });

  // Filter valid expenses within date range
  const validExpenses = allExpenses.filter((e) => !(e as any).isDeleted);
  const filteredExp = filterItemsByDateRange(validExpenses, config);

  // Filter valid settlements within date range
  const validSettlements = allSettlements.filter(
    (s) => s.status === 'completed' || !s.status
  );
  const filteredSet = filterItemsByDateRange(validSettlements, config);

  let totalPersonalShare = 0;
  let totalAmountPaid = 0;
  let settlementsSent = 0;
  let settlementsReceived = 0;

  const categoryTotals = new Map<string, number>();
  const monthlyMap = new Map<string, { paid: number; share: number }>();
  const expenseRows: PersonalReportData['expenses'] = [];

  filteredExp.forEach((exp) => {
    const group = groupMap.get(exp.groupId);
    const joinedAt = group?.membersJoinedAt?.[currentUid];
    const includeExisting = group?.memberExistingExpensesPreference?.[currentUid] ?? true;
    const expTime = exp.createdAt?.seconds
      ? exp.createdAt.seconds * 1000
      : parseFirestoreDate(exp.createdAt, exp.date).getTime();
    const isExcludedPreJoin = !includeExisting && joinedAt && expTime < joinedAt;

    const effectiveSplits = getEffectiveSplitDetails(exp, group);
    const amount = Number(exp.amount) || 0;
    const paidByMe = exp.paidBy === currentUid ? amount : 0;
    const myShare =
      currentUid && !isExcludedPreJoin && effectiveSplits[currentUid] !== undefined
        ? Number(effectiveSplits[currentUid]) || 0
        : 0;

    // Only include in personal report if user paid or participated
    if (paidByMe > 0 || myShare > 0) {
      totalAmountPaid += paidByMe;
      totalPersonalShare += myShare;

      // Category breakdown uses user's effective share of the expense (or paid if sole payer)
      const catKey = exp.category || 'other';
      const catVal = myShare > 0 ? myShare : paidByMe;
      categoryTotals.set(catKey, (categoryTotals.get(catKey) || 0) + catVal);

      // Monthly breakdown
      const bMonth = getExpenseBillingMonth(exp);
      const curMonth = monthlyMap.get(bMonth) || { paid: 0, share: 0 };
      curMonth.paid += paidByMe;
      curMonth.share += myShare;
      monthlyMap.set(bMonth, curMonth);

      const d = parseFirestoreDate(exp.createdAt, exp.date);
      expenseRows.push({
        id: exp.expenseId || (exp as any).id || '',
        date: formatLocalDateToYMD(d),
        title: exp.title || (exp as any).description || 'Untitled Expense',
        category: normalizeCategoryName(exp.category),
        groupName: group?.name || 'Group',
        totalAmount: amount,
        paidByMe,
        myShare,
      });
    }
  });

  const settlementRows: PersonalReportData['settlements'] = [];
  filteredSet.forEach((s) => {
    const isSender = s.fromUserId === currentUid;
    const isReceiver = s.toUserId === currentUid;

    if (isSender || isReceiver) {
      const amt = Number(s.amount) || 0;
      if (isSender) settlementsSent += amt;
      if (isReceiver) settlementsReceived += amt;

      const counterpartyUid = isSender ? s.toUserId : s.fromUserId;
      const counterpartyProfile = usersMap.get(counterpartyUid);
      const counterpartyName = counterpartyProfile?.name || 'Member';

      const d = parseFirestoreDate(s.createdAt, (s as any).date);
      settlementRows.push({
        id: s.settlementId || (s as any).id || '',
        date: formatLocalDateToYMD(d),
        counterparty: counterpartyName,
        direction: isSender ? 'SENT' : 'RECEIVED',
        amount: amt,
        status: s.status || 'completed',
      });
    }
  });

  // Sort expenses and settlements newest first
  expenseRows.sort((a, b) => b.date.localeCompare(a.date));
  settlementRows.sort((a, b) => b.date.localeCompare(a.date));

  // Category breakdown percentages
  const catTotalSum = Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0);
  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([cat, amt]) => ({
      category: cat,
      label: normalizeCategoryName(cat),
      amount: Math.round(amt * 100) / 100,
      percentage: catTotalSum > 0 ? Math.round((amt / catTotalSum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly summary
  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, val]) => {
      const [year, m] = month.split('-');
      const d = new Date(Number(year), Number(m) - 1, 1);
      return {
        month,
        label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
        userPaid: Math.round(val.paid * 100) / 100,
        userShare: Math.round(val.share * 100) / 100,
        net: Math.round((val.paid - val.share) * 100) / 100,
      };
    });

  const netBalance = Math.round(
    (totalAmountPaid - totalPersonalShare + settlementsSent - settlementsReceived) * 100
  ) / 100;

  return {
    user: {
      uid: currentUid,
      name: currentUser.displayName || 'You',
      email: currentUser.email || '',
    },
    dateRange,
    generatedAt: new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    metrics: {
      totalPersonalShare: Math.round(totalPersonalShare * 100) / 100,
      totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
      netBalance,
      totalExpensesCount: expenseRows.length,
      settlementsSent: Math.round(settlementsSent * 100) / 100,
      settlementsReceived: Math.round(settlementsReceived * 100) / 100,
    },
    monthlyBreakdown,
    categoryBreakdown,
    expenses: expenseRows,
    settlements: settlementRows,
  };
}

// ============================================================================
// Data Builder: Group Financial Report
// ============================================================================

export function buildGroupReportData(
  config: ReportConfig,
  allExpenses: ExpenseData[],
  allSettlements: SettlementData[],
  group: GroupData,
  groupMembers: UserProfile[],
  usersMap: Map<string, UserProfile>
): GroupReportData {
  const groupId = group.groupId;
  const dateRange = resolveDateRangeInfo(config);

  // Filter expenses strictly belonging to this group
  const groupExpenses = allExpenses
    .filter((e) => e.groupId === groupId && !(e as any).isDeleted);
  const filteredExp = filterItemsByDateRange(groupExpenses, config);

  // Filter settlements strictly belonging to this group
  const groupSettlements = allSettlements
    .filter((s) => s.groupId === groupId && (s.status === 'completed' || !s.status));
  const filteredSet = filterItemsByDateRange(groupSettlements, config);

  // Resolve all member UIDs in the group
  const allMemberUids = new Set<string>(group.memberIds || []);
  groupMembers.forEach((m) => {
    if (m.uid) allMemberUids.add(m.uid);
  });
  group.membersDetails?.forEach((m) => {
    if (m.uid) allMemberUids.add(m.uid);
  });

  const memberStats = new Map<
    string,
    { paid: number; share: number; sent: number; received: number }
  >();
  allMemberUids.forEach((uid) => {
    memberStats.set(uid, { paid: 0, share: 0, sent: 0, received: 0 });
  });

  let totalGroupExpenses = 0;
  const categoryTotals = new Map<string, number>();
  const expenseRows: GroupReportData['expenses'] = [];

  filteredExp.forEach((exp) => {
    const amt = Number(exp.amount) || 0;
    totalGroupExpenses += amt;

    const catKey = exp.category || 'other';
    categoryTotals.set(catKey, (categoryTotals.get(catKey) || 0) + amt);

    // Track payer
    if (exp.paidBy) {
      if (!memberStats.has(exp.paidBy)) {
        memberStats.set(exp.paidBy, { paid: 0, share: 0, sent: 0, received: 0 });
      }
      memberStats.get(exp.paidBy)!.paid += amt;
    }

    // Track splits
    const effectiveSplits = getEffectiveSplitDetails(exp, group);
    const participantNames: string[] = [];
    Object.entries(effectiveSplits).forEach(([uid, share]) => {
      const sVal = Number(share) || 0;
      if (!memberStats.has(uid)) {
        memberStats.set(uid, { paid: 0, share: 0, sent: 0, received: 0 });
      }
      memberStats.get(uid)!.share += sVal;

      const profile = usersMap.get(uid) || groupMembers.find((m) => m.uid === uid);
      participantNames.push(`${profile?.name || 'Member'}: Rs.${sVal}`);
    });

    const d = parseFirestoreDate(exp.createdAt, exp.date);
    const payerProfile = usersMap.get(exp.paidBy) || groupMembers.find((m) => m.uid === exp.paidBy);

    expenseRows.push({
      id: exp.expenseId || (exp as any).id || '',
      date: formatLocalDateToYMD(d),
      title: exp.title || (exp as any).description || 'Untitled Expense',
      category: normalizeCategoryName(exp.category),
      paidByName: payerProfile?.name || 'Member',
      totalAmount: amt,
      participantsCount: Object.keys(effectiveSplits).length,
      participantsSummary: participantNames.join(', '),
    });
  });

  let totalSettlementsAmount = 0;
  const settlementRows: GroupReportData['settlements'] = [];

  filteredSet.forEach((s) => {
    const amt = Number(s.amount) || 0;
    totalSettlementsAmount += amt;

    if (s.fromUserId) {
      if (!memberStats.has(s.fromUserId)) {
        memberStats.set(s.fromUserId, { paid: 0, share: 0, sent: 0, received: 0 });
      }
      memberStats.get(s.fromUserId)!.sent += amt;
    }
    if (s.toUserId) {
      if (!memberStats.has(s.toUserId)) {
        memberStats.set(s.toUserId, { paid: 0, share: 0, sent: 0, received: 0 });
      }
      memberStats.get(s.toUserId)!.received += amt;
    }

    const senderProfile = usersMap.get(s.fromUserId) || groupMembers.find((m) => m.uid === s.fromUserId);
    const receiverProfile = usersMap.get(s.toUserId) || groupMembers.find((m) => m.uid === s.toUserId);

    const d = parseFirestoreDate(s.createdAt, (s as any).date);
    settlementRows.push({
      id: s.settlementId || (s as any).id || '',
      date: formatLocalDateToYMD(d),
      fromName: senderProfile?.name || 'Member',
      toName: receiverProfile?.name || 'Member',
      amount: amt,
      status: s.status || 'completed',
    });
  });

  // Sort transactions newest first
  expenseRows.sort((a, b) => b.date.localeCompare(a.date));
  settlementRows.sort((a, b) => b.date.localeCompare(a.date));

  // Category breakdown
  const catTotalSum = Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0);
  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([cat, amt]) => ({
      category: cat,
      label: normalizeCategoryName(cat),
      amount: Math.round(amt * 100) / 100,
      percentage: catTotalSum > 0 ? Math.round((amt / catTotalSum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Member breakdown with canonical net balance calculation:
  // (Amount Paid - Expense Share) + (Settlements Sent - Settlements Received)
  const memberBreakdown = Array.from(memberStats.entries()).map(([uid, stats]) => {
    const profile = usersMap.get(uid) || groupMembers.find((m) => m.uid === uid);
    const name = profile?.name || 'Member';
    const netBalance = Math.round((stats.paid - stats.share + stats.sent - stats.received) * 100) / 100;
    const percentShare =
      totalGroupExpenses > 0 ? Math.round((stats.share / totalGroupExpenses) * 1000) / 10 : 0;

    return {
      uid,
      name,
      amountPaid: Math.round(stats.paid * 100) / 100,
      expenseShare: Math.round(stats.share * 100) / 100,
      netBalance,
      percentShare,
    };
  });

  // Sort members: highest spenders first
  memberBreakdown.sort((a, b) => b.amountPaid - a.amountPaid);

  return {
    group: {
      id: group.groupId || '',
      name: group.name || 'Unnamed Group',
      memberCount: allMemberUids.size,
      currency: 'INR',
    },
    dateRange,
    generatedAt: new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    metrics: {
      totalGroupExpenses: Math.round(totalGroupExpenses * 100) / 100,
      expenseCount: expenseRows.length,
      totalSettlementsAmount: Math.round(totalSettlementsAmount * 100) / 100,
      settlementCount: settlementRows.length,
    },
    memberBreakdown,
    categoryBreakdown,
    expenses: expenseRows,
    settlements: settlementRows,
  };
}

// ============================================================================
// CSV Report Generators
// ============================================================================

export function generatePersonalCsv(data: PersonalReportData): string {
  const lines: string[] = [];

  // Header & Meta
  lines.push('SPLITMATE FINANCIAL REPORT - PERSONAL');
  lines.push(`Generated On,${sanitizeCsvCell(data.generatedAt)}`);
  lines.push(`User,${sanitizeCsvCell(data.user.name)} (${sanitizeCsvCell(data.user.email)})`);
  lines.push(`Reporting Period,${sanitizeCsvCell(data.dateRange.label)}`);
  lines.push('Currency,INR');
  lines.push('');

  // 1. Overview Summary
  lines.push('1. FINANCIAL OVERVIEW');
  lines.push('Metric,Amount (INR)');
  lines.push(`Total Personal Expense Share,${data.metrics.totalPersonalShare.toFixed(2)}`);
  lines.push(`Total Amount Paid by Me,${data.metrics.totalAmountPaid.toFixed(2)}`);
  lines.push(`Net Financial Position,${data.metrics.netBalance.toFixed(2)}`);
  lines.push(`Total Expenses Count,${data.metrics.totalExpensesCount}`);
  lines.push(`Total Settlements Sent,${data.metrics.settlementsSent.toFixed(2)}`);
  lines.push(`Total Settlements Received,${data.metrics.settlementsReceived.toFixed(2)}`);
  lines.push('');

  // 2. Monthly Summary
  lines.push('2. MONTHLY SPENDING SUMMARY');
  lines.push('Month,Amount Paid by Me (INR),My Expense Share (INR),Net Position (INR)');
  if (data.monthlyBreakdown.length === 0) {
    lines.push('No activity recorded for the selected period,,,');
  } else {
    data.monthlyBreakdown.forEach((m) => {
      lines.push(`${sanitizeCsvCell(m.label)},${m.userPaid.toFixed(2)},${m.userShare.toFixed(2)},${m.net.toFixed(2)}`);
    });
  }
  lines.push('');

  // 3. Category Summary
  lines.push('3. CATEGORY-WISE SPENDING');
  lines.push('Category,Total Amount (INR),Percentage (%)');
  if (data.categoryBreakdown.length === 0) {
    lines.push('No expenses recorded for the selected period,,');
  } else {
    data.categoryBreakdown.forEach((c) => {
      lines.push(`${sanitizeCsvCell(c.label)},${c.amount.toFixed(2)},${c.percentage.toFixed(1)}%`);
    });
  }
  lines.push('');

  // 4. Expense Transactions
  lines.push('4. DETAILED EXPENSE TRANSACTIONS');
  lines.push('Date,Description,Category,Group,Total Expense (INR),Paid by Me (INR),My Share (INR)');
  if (data.expenses.length === 0) {
    lines.push('No expenses found for this period,,,,,,');
  } else {
    data.expenses.forEach((e) => {
      lines.push(
        `${sanitizeCsvCell(e.date)},${sanitizeCsvCell(e.title)},${sanitizeCsvCell(e.category)},${sanitizeCsvCell(e.groupName)},${e.totalAmount.toFixed(2)},${e.paidByMe.toFixed(2)},${e.myShare.toFixed(2)}`
      );
    });
  }
  lines.push('');

  // 5. Settlement History
  lines.push('5. SETTLEMENT TRANSACTIONS');
  lines.push('Date,Counterparty,Direction,Amount (INR),Status');
  if (data.settlements.length === 0) {
    lines.push('No settlements recorded for this period,,,,');
  } else {
    data.settlements.forEach((s) => {
      lines.push(
        `${sanitizeCsvCell(s.date)},${sanitizeCsvCell(s.counterparty)},${sanitizeCsvCell(s.direction)},${s.amount.toFixed(2)},${sanitizeCsvCell(s.status)}`
      );
    });
  }

  // Prepend UTF-8 Byte Order Mark (BOM) for Excel
  return '\uFEFF' + lines.join('\r\n');
}

export function generateGroupCsv(data: GroupReportData): string {
  const lines: string[] = [];

  // Header & Meta
  lines.push('SPLITMATE FINANCIAL REPORT - GROUP');
  lines.push(`Group Name,${sanitizeCsvCell(data.group.name)}`);
  lines.push(`Total Members,${data.group.memberCount}`);
  lines.push(`Generated On,${sanitizeCsvCell(data.generatedAt)}`);
  lines.push(`Reporting Period,${sanitizeCsvCell(data.dateRange.label)}`);
  lines.push('Currency,INR');
  lines.push('');

  // 1. Group Overview
  lines.push('1. GROUP FINANCIAL OVERVIEW');
  lines.push('Metric,Value');
  lines.push(`Total Group Expenses (INR),${data.metrics.totalGroupExpenses.toFixed(2)}`);
  lines.push(`Total Expenses Count,${data.metrics.expenseCount}`);
  lines.push(`Total Settlements Recorded (INR),${data.metrics.totalSettlementsAmount.toFixed(2)}`);
  lines.push(`Total Settlements Count,${data.metrics.settlementCount}`);
  lines.push('');

  // 2. Member Breakdown
  lines.push('2. MEMBER-WISE FINANCIAL BREAKDOWN');
  lines.push('Member Name,Amount Paid (INR),Expense Share (INR),Net Balance (INR),Share Percentage (%)');
  if (data.memberBreakdown.length === 0) {
    lines.push('No members found,,,,');
  } else {
    data.memberBreakdown.forEach((m) => {
      lines.push(
        `${sanitizeCsvCell(m.name)},${m.amountPaid.toFixed(2)},${m.expenseShare.toFixed(2)},${m.netBalance.toFixed(2)},${m.percentShare.toFixed(1)}%`
      );
    });
  }
  lines.push('');

  // 3. Category Breakdown
  lines.push('3. CATEGORY-WISE GROUP SPENDING');
  lines.push('Category,Total Amount (INR),Percentage (%)');
  if (data.categoryBreakdown.length === 0) {
    lines.push('No expenses recorded for this period,,');
  } else {
    data.categoryBreakdown.forEach((c) => {
      lines.push(`${sanitizeCsvCell(c.label)},${c.amount.toFixed(2)},${c.percentage.toFixed(1)}%`);
    });
  }
  lines.push('');

  // 4. Expense Transactions
  lines.push('4. DETAILED EXPENSE TRANSACTIONS');
  lines.push('Date,Description,Category,Paid By,Total Amount (INR),Split Details');
  if (data.expenses.length === 0) {
    lines.push('No expenses found for this period,,,,,');
  } else {
    data.expenses.forEach((e) => {
      lines.push(
        `${sanitizeCsvCell(e.date)},${sanitizeCsvCell(e.title)},${sanitizeCsvCell(e.category)},${sanitizeCsvCell(e.paidByName)},${e.totalAmount.toFixed(2)},${sanitizeCsvCell(e.participantsSummary)}`
      );
    });
  }
  lines.push('');

  // 5. Settlement History
  lines.push('5. SETTLEMENT TRANSACTIONS');
  lines.push('Date,From (Sender),To (Receiver),Amount (INR),Status');
  if (data.settlements.length === 0) {
    lines.push('No settlements recorded for this period,,,,');
  } else {
    data.settlements.forEach((s) => {
      lines.push(
        `${sanitizeCsvCell(s.date)},${sanitizeCsvCell(s.fromName)},${sanitizeCsvCell(s.toName)},${s.amount.toFixed(2)},${sanitizeCsvCell(s.status)}`
      );
    });
  }

  // Prepend UTF-8 Byte Order Mark (BOM) for Excel
  return '\uFEFF' + lines.join('\r\n');
}

// ============================================================================
// PDF Report Generators (Vector Multi-Page via pdf-lib)
// ============================================================================

const PAGE_WIDTH = 595.28; // A4 portrait width in points
const PAGE_HEIGHT = 841.89; // A4 portrait height in points
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Brand Colors in pdf-lib rgb format
const COLOR_PRIMARY = rgb(0.0, 0.71, 0.85); // SplitMate Cyan #00B4D8
const COLOR_PRIMARY_DARK = rgb(0.10, 0.35, 0.82); // SplitMate Royal Blue #1A59D1
const COLOR_HEADER_BG = rgb(0.04, 0.08, 0.16); // Deep Executive Navy #0B1429
const COLOR_TEXT_DARK = rgb(0.06, 0.09, 0.16); // Slate 900 #0F172A
const COLOR_TEXT_MUTED = rgb(0.39, 0.45, 0.55); // Slate 500 #64748B
const COLOR_CARD_BG = rgb(0.97, 0.98, 0.99); // Light Slate #F8FAFC
const COLOR_ROW_ALT = rgb(0.95, 0.97, 0.99); // Muted Tint #F1F5F9
const COLOR_BORDER = rgb(0.88, 0.91, 0.94); // Border #E2E8F0
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_GREEN = rgb(0.05, 0.65, 0.45); // Emerald Green #0D9F73
const COLOR_RED = rgb(0.92, 0.25, 0.25); // Rose Red #EB4040
const COLOR_TABLE_HEADER_BG = rgb(0.07, 0.11, 0.21); // Executive Slate Navy #121C35

class PdfReportBuilder {
  doc!: PDFDocument;
  fontNormal!: PDFFont;
  fontBold!: PDFFont;
  logoImage?: PDFImage;
  currentPage!: PDFPage;
  cursorY: number = PAGE_HEIGHT - MARGIN;
  pageNumber: number = 1;
  totalPages: number = 1;
  periodLabel: string = '';

  static async create(periodLabel: string) {
    const builder = new PdfReportBuilder();
    builder.doc = await PDFDocument.create();
    builder.fontNormal = await builder.doc.embedFont(StandardFonts.Helvetica);
    builder.fontBold = await builder.doc.embedFont(StandardFonts.HelveticaBold);
    builder.periodLabel = periodLabel;

    try {
      if (SPLITMATE_LOGO_BASE64) {
        builder.logoImage = await builder.doc.embedPng(SPLITMATE_LOGO_BASE64);
      }
    } catch (e) {
      // Continue gracefully if image embedding encounters any issue
    }

    builder.addNewPage();
    return builder;
  }

  addNewPage() {
    this.currentPage = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - MARGIN;
    this.pageNumber = this.doc.getPageCount();
  }

  ensureSpace(neededHeight: number) {
    if (this.cursorY - neededHeight < MARGIN + 40) {
      this.addNewPage();
    }
  }

  drawTextSafe(
    text: string,
    options: {
      x: number;
      y: number;
      size: number;
      font: PDFFont;
      color?: any;
    },
    fallback: string = ''
  ) {
    const safe = cleanPdfText(text, fallback);
    if (!safe) return;
    this.currentPage.drawText(safe, options);
  }

  drawHeader(title: string, subtitle: string, metaFields: [string, string][]) {
    const bannerHeight = 84;
    const bannerY = this.cursorY - bannerHeight;

    // Executive Navy Header Banner
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: bannerY,
      width: CONTENT_WIDTH,
      height: bannerHeight,
      color: COLOR_HEADER_BG,
    });

    // Top Signature Dual-Accent Strip (SplitMate Cyan & Royal Blue)
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.cursorY - 3.5,
      width: CONTENT_WIDTH * 0.42,
      height: 3.5,
      color: COLOR_PRIMARY,
    });
    this.currentPage.drawRectangle({
      x: MARGIN + CONTENT_WIDTH * 0.42,
      y: this.cursorY - 3.5,
      width: CONTENT_WIDTH * 0.58,
      height: 3.5,
      color: COLOR_PRIMARY_DARK,
    });

    // Logo Container Card (Crisp White Rounded Badge)
    const logoCardSize = 54;
    const logoCardX = MARGIN + 14;
    const logoCardY = bannerY + (bannerHeight - 3.5 - logoCardSize) / 2;

    this.currentPage.drawRectangle({
      x: logoCardX,
      y: logoCardY,
      width: logoCardSize,
      height: logoCardSize,
      color: COLOR_WHITE,
      borderColor: rgb(0.85, 0.90, 0.96),
      borderWidth: 1,
    });

    // Draw SplitMate Logo Image inside badge
    if (this.logoImage) {
      const logoSize = 44;
      const logoOffset = (logoCardSize - logoSize) / 2;
      this.currentPage.drawImage(this.logoImage, {
        x: logoCardX + logoOffset,
        y: logoCardY + logoOffset,
        width: logoSize,
        height: logoSize,
      });
    }

    // App Branding & Title Block
    const textStartX = logoCardX + logoCardSize + 14;

    // Line 1: SplitMate Brand Name + Statement Pill
    this.drawTextSafe('SPLITMATE', {
      x: textStartX,
      y: bannerY + 54,
      size: 11,
      font: this.fontBold,
      color: rgb(0.22, 0.74, 0.97),
    });

    const brandNameWidth = this.fontBold.widthOfTextAtSize('SPLITMATE', 11);
    const pillX = textStartX + brandNameWidth + 8;
    this.currentPage.drawRectangle({
      x: pillX,
      y: bannerY + 51.5,
      width: 108,
      height: 14,
      color: rgb(0.10, 0.18, 0.32),
    });
    this.drawTextSafe('FINANCIAL STATEMENT', {
      x: pillX + 6,
      y: bannerY + 55,
      size: 6.5,
      font: this.fontBold,
      color: rgb(0.75, 0.88, 1.0),
    });

    // Right Side: Official Verified Badge
    const badgeW = 90;
    const badgeH = 18;
    const badgeX = MARGIN + CONTENT_WIDTH - badgeW - 14;
    this.currentPage.drawRectangle({
      x: badgeX,
      y: bannerY + 49,
      width: badgeW,
      height: badgeH,
      color: rgb(0.08, 0.16, 0.28),
      borderColor: rgb(0.20, 0.35, 0.55),
      borderWidth: 0.75,
    });
    this.drawTextSafe('OFFICIAL REPORT', {
      x: badgeX + 11,
      y: bannerY + 54,
      size: 6.5,
      font: this.fontBold,
      color: COLOR_PRIMARY,
    });

    // Line 2: Report Title (Large Crisp White)
    this.drawTextSafe(title, {
      x: textStartX,
      y: bannerY + 33,
      size: 16,
      font: this.fontBold,
      color: COLOR_WHITE,
    });

    // Line 3: Subtitle / Prepared for
    this.drawTextSafe(subtitle, {
      x: textStartX,
      y: bannerY + 17,
      size: 8.5,
      font: this.fontNormal,
      color: rgb(0.72, 0.80, 0.90),
    });

    this.cursorY = bannerY - 10;

    // Metadata Strip Bar
    const metaBarHeight = 28;
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.cursorY - metaBarHeight,
      width: CONTENT_WIDTH,
      height: metaBarHeight,
      color: COLOR_CARD_BG,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
    });

    const colWidth = CONTENT_WIDTH / metaFields.length;
    metaFields.forEach(([rawLabel, rawVal], idx) => {
      const label = cleanPdfText(rawLabel);
      const val = cleanPdfText(rawVal);
      const colX = MARGIN + idx * colWidth;

      if (idx > 0) {
        this.currentPage.drawLine({
          start: { x: colX, y: this.cursorY - metaBarHeight + 4 },
          end: { x: colX, y: this.cursorY - 4 },
          thickness: 0.75,
          color: COLOR_BORDER,
        });
      }

      this.drawTextSafe(label.toUpperCase(), {
        x: colX + 10,
        y: this.cursorY - 12,
        size: 6.5,
        font: this.fontBold,
        color: COLOR_TEXT_MUTED,
      });

      this.drawTextSafe(val, {
        x: colX + 10,
        y: this.cursorY - 22,
        size: 8,
        font: this.fontBold,
        color: COLOR_TEXT_DARK,
      });
    });

    this.cursorY -= metaBarHeight + 16;
  }

  drawSectionTitle(title: string) {
    this.ensureSpace(36);
    const titleY = this.cursorY - 14;

    // Vertical Cyan Accent Indicator
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: titleY - 1,
      width: 3.5,
      height: 12,
      color: COLOR_PRIMARY,
    });

    const safeTitle = cleanPdfText(title.toUpperCase());
    this.drawTextSafe(safeTitle, {
      x: MARGIN + 10,
      y: titleY,
      size: 10,
      font: this.fontBold,
      color: COLOR_TEXT_DARK,
    });

    const titleW = this.fontBold.widthOfTextAtSize(safeTitle, 10);
    const lineStartX = MARGIN + 10 + titleW + 10;
    if (lineStartX < MARGIN + CONTENT_WIDTH) {
      this.currentPage.drawLine({
        start: { x: lineStartX, y: titleY + 4 },
        end: { x: MARGIN + CONTENT_WIDTH, y: titleY + 4 },
        thickness: 0.75,
        color: COLOR_BORDER,
      });
    }

    this.cursorY -= 28;
  }

  drawMetricCards(cards: { label: string; value: string; color?: any }[]) {
    this.ensureSpace(56);
    const cardGap = 8;
    const cardWidth = (CONTENT_WIDTH - (cards.length - 1) * cardGap) / cards.length;
    const cardHeight = 48;

    cards.forEach((card, idx) => {
      const x = MARGIN + idx * (cardWidth + cardGap);
      const y = this.cursorY - cardHeight;

      // Card container
      this.currentPage.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: COLOR_WHITE,
        borderColor: COLOR_BORDER,
        borderWidth: 1,
      });

      // Distinct colored top accent strip
      const topAccentColors = [
        COLOR_PRIMARY,
        rgb(0.20, 0.45, 0.90),
        card.color || COLOR_GREEN,
        rgb(0.50, 0.35, 0.85),
      ];
      const accentColor = topAccentColors[idx % topAccentColors.length];
      this.currentPage.drawRectangle({
        x,
        y: y + cardHeight - 2.5,
        width: cardWidth,
        height: 2.5,
        color: accentColor,
      });

      this.drawTextSafe(card.label.toUpperCase(), {
        x: x + 8,
        y: y + cardHeight - 16,
        size: 6.5,
        font: this.fontBold,
        color: COLOR_TEXT_MUTED,
      });

      this.drawTextSafe(card.value, {
        x: x + 8,
        y: y + 10,
        size: 11.5,
        font: this.fontBold,
        color: card.color || COLOR_TEXT_DARK,
      });
    });

    this.cursorY -= cardHeight + 14;
  }

  drawTable(headers: string[], widths: number[], rows: string[][], alignments?: ('left' | 'right')[]) {
    const rowHeight = 20;
    const headerHeight = 22;

    this.ensureSpace(headerHeight + rowHeight + 10);

    // Modern executive dark navy table header
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.cursorY - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: COLOR_TABLE_HEADER_BG,
    });

    // Top primary cyan micro-accent line on table
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.cursorY - 1.5,
      width: CONTENT_WIDTH,
      height: 1.5,
      color: COLOR_PRIMARY,
    });

    let colX = MARGIN;
    headers.forEach((rawH, i) => {
      const h = cleanPdfText(rawH);
      const align = alignments?.[i] || 'left';
      const w = widths[i];
      const textX = align === 'right' ? colX + w - 8 - this.fontBold.widthOfTextAtSize(h, 7.5) : colX + 8;

      this.drawTextSafe(h, {
        x: textX,
        y: this.cursorY - 15,
        size: 7.5,
        font: this.fontBold,
        color: COLOR_WHITE,
      });
      colX += w;
    });

    this.cursorY -= headerHeight;

    if (rows.length === 0) {
      this.ensureSpace(rowHeight + 6);
      this.currentPage.drawRectangle({
        x: MARGIN,
        y: this.cursorY - (rowHeight + 6),
        width: CONTENT_WIDTH,
        height: rowHeight + 6,
        color: COLOR_CARD_BG,
        borderColor: COLOR_BORDER,
        borderWidth: 1,
      });
      this.drawTextSafe('No transactions or records found for the selected period.', {
        x: MARGIN + 12,
        y: this.cursorY - 17,
        size: 8,
        font: this.fontNormal,
        color: COLOR_TEXT_MUTED,
      });
      this.cursorY -= (rowHeight + 6) + 12;
      return;
    }

    // Draw table rows with crisp alternating backgrounds and borders
    rows.forEach((row, rowIdx) => {
      this.ensureSpace(rowHeight);

      // Alternating background
      if (rowIdx % 2 === 1) {
        this.currentPage.drawRectangle({
          x: MARGIN,
          y: this.cursorY - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: COLOR_ROW_ALT,
        });
      }

      // Border bottom
      this.currentPage.drawLine({
        start: { x: MARGIN, y: this.cursorY - rowHeight },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.cursorY - rowHeight },
        thickness: 0.5,
        color: COLOR_BORDER,
      });

      let cellX = MARGIN;
      row.forEach((cell, i) => {
        const align = alignments?.[i] || 'left';
        const w = widths[i];
        const truncated = this.truncateText(cell, w - 16, 7.5);
        const textX =
          align === 'right'
            ? cellX + w - 8 - this.fontNormal.widthOfTextAtSize(truncated, 7.5)
            : cellX + 8;

        let cellColor = COLOR_TEXT_DARK;
        if (cell.startsWith('+Rs.') || cell === 'Completed' || cell === 'completed') {
          cellColor = COLOR_GREEN;
        } else if (cell.startsWith('-Rs.')) {
          cellColor = COLOR_RED;
        }

        const isAmountCol = align === 'right';
        this.drawTextSafe(truncated, {
          x: textX,
          y: this.cursorY - 14,
          size: 7.5,
          font: isAmountCol ? this.fontBold : this.fontNormal,
          color: cellColor,
        });
        cellX += w;
      });

      this.cursorY -= rowHeight;
    });

    this.cursorY -= 14;
  }

  truncateText(text: string, maxWidth: number, size: number): string {
    const safeText = cleanPdfText(text, '—');
    if (this.fontNormal.widthOfTextAtSize(safeText, size) <= maxWidth) return safeText;
    let t = safeText;
    while (t.length > 3 && this.fontNormal.widthOfTextAtSize(t + '...', size) > maxWidth) {
      t = t.substring(0, t.length - 1);
    }
    return t + '...';
  }

  addFooters() {
    const pageCount = this.doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const page = this.doc.getPage(i);

      page.drawLine({
        start: { x: MARGIN, y: MARGIN + 16 },
        end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 16 },
        thickness: 0.75,
        color: COLOR_BORDER,
      });

      const brandText = 'SplitMate';
      this.drawTextSafe(brandText, {
        x: MARGIN,
        y: MARGIN,
        size: 7.5,
        font: this.fontBold,
        color: COLOR_PRIMARY,
      });

      const brandW = this.fontBold.widthOfTextAtSize(brandText, 7.5);
      this.drawTextSafe(' • Smart Group Expense Sharing & Financial Ledger', {
        x: MARGIN + brandW,
        y: MARGIN,
        size: 7.5,
        font: this.fontNormal,
        color: COLOR_TEXT_MUTED,
      });

      const pageNumStr = `Page ${i + 1} of ${pageCount}`;
      const pageNumW = this.fontNormal.widthOfTextAtSize(pageNumStr, 7.5);
      this.drawTextSafe(pageNumStr, {
        x: PAGE_WIDTH - MARGIN - pageNumW,
        y: MARGIN,
        size: 7.5,
        font: this.fontBold,
        color: COLOR_TEXT_DARK,
      });
    }
  }

  async finish(): Promise<string> {
    this.addFooters();
    return await this.doc.saveAsBase64();
  }
}

export async function generatePersonalPdf(data: PersonalReportData): Promise<string> {
  const builder = await PdfReportBuilder.create(data.dateRange.label);

  // 1. Cover / Header
  builder.drawHeader(
    'Personal Financial Report',
    `Prepared for ${data.user.name} • ${data.user.email}`,
    [
      ['Period', data.dateRange.label],
      ['Generated', data.generatedAt.split(',')[0]],
      ['Currency', 'INR (Rs.)'],
    ]
  );

  // 2. Financial Overview Cards
  builder.drawSectionTitle('1. Financial Overview');
  const netColor = data.metrics.netBalance >= 0 ? COLOR_GREEN : COLOR_RED;
  const netSign = data.metrics.netBalance >= 0 ? '+' : '';
  builder.drawMetricCards([
    { label: 'My Expense Share', value: `Rs. ${data.metrics.totalPersonalShare.toLocaleString('en-IN')}` },
    { label: 'Amount Paid by Me', value: `Rs. ${data.metrics.totalAmountPaid.toLocaleString('en-IN')}` },
    {
      label: 'Net Balance',
      value: `${netSign}Rs. ${Math.abs(data.metrics.netBalance).toLocaleString('en-IN')}`,
      color: netColor,
    },
    { label: 'Total Expenses', value: `${data.metrics.totalExpensesCount}` },
  ]);

  // 3. Monthly Spending Summary Table
  builder.drawSectionTitle('2. Monthly Spending Summary');
  const monthlyHeaders = ['Month', 'Paid by Me', 'My Expense Share', 'Net Position'];
  const monthlyWidths = [150, 120, 120, 125];
  const monthlyRows = data.monthlyBreakdown.map((m) => [
    m.label,
    `Rs. ${m.userPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Rs. ${m.userShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `${m.net >= 0 ? '+' : ''}Rs. ${m.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  ]);
  builder.drawTable(monthlyHeaders, monthlyWidths, monthlyRows, ['left', 'right', 'right', 'right']);

  // 4. Category-wise Spending Table
  builder.drawSectionTitle('3. Category-wise Spending');
  const catHeaders = ['Category', 'Total Amount', 'Share %'];
  const catWidths = [275, 120, 120];
  const catRows = data.categoryBreakdown.map((c) => [
    c.label,
    `Rs. ${c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `${c.percentage.toFixed(1)}%`,
  ]);
  builder.drawTable(catHeaders, catWidths, catRows, ['left', 'right', 'right']);

  // 5. Detailed Expense Transactions Table
  builder.drawSectionTitle('4. Detailed Expense Transactions');
  const expHeaders = ['Date', 'Description', 'Category', 'Group', 'Paid by Me', 'My Share'];
  const expWidths = [65, 140, 90, 80, 70, 70];
  const expRows = data.expenses.map((e) => [
    e.date,
    e.title,
    e.category,
    e.groupName,
    `Rs. ${e.paidByMe.toFixed(2)}`,
    `Rs. ${e.myShare.toFixed(2)}`,
  ]);
  builder.drawTable(expHeaders, expWidths, expRows, ['left', 'left', 'left', 'left', 'right', 'right']);

  // 6. Settlement Summary Table
  builder.drawSectionTitle('5. Settlement Summary');
  const setHeaders = ['Date', 'Counterparty', 'Direction', 'Amount', 'Status'];
  const setWidths = [80, 160, 100, 95, 80];
  const setRows = data.settlements.map((s) => [
    s.date,
    s.counterparty,
    s.direction === 'SENT' ? 'Paid to' : 'Received from',
    `Rs. ${s.amount.toFixed(2)}`,
    s.status,
  ]);
  builder.drawTable(setHeaders, setWidths, setRows, ['left', 'left', 'left', 'right', 'left']);

  return await builder.finish();
}

export async function generateGroupPdf(data: GroupReportData): Promise<string> {
  const builder = await PdfReportBuilder.create(data.dateRange.label);

  // 1. Cover / Header
  builder.drawHeader(
    'Group Financial Report',
    `Group: ${data.group.name} • ${data.group.memberCount} Members`,
    [
      ['Period', data.dateRange.label],
      ['Generated', data.generatedAt.split(',')[0]],
      ['Currency', 'INR (Rs.)'],
    ]
  );

  // 2. Group Overview Cards
  builder.drawSectionTitle('1. Group Financial Overview');
  builder.drawMetricCards([
    { label: 'Total Group Expenses', value: `Rs. ${data.metrics.totalGroupExpenses.toLocaleString('en-IN')}` },
    { label: 'Total Expenses Count', value: `${data.metrics.expenseCount}` },
    { label: 'Settlements Amount', value: `Rs. ${data.metrics.totalSettlementsAmount.toLocaleString('en-IN')}` },
    { label: 'Total Members', value: `${data.group.memberCount}` },
  ]);

  // 3. Member-wise Financial Breakdown
  builder.drawSectionTitle('2. Member-wise Financial Breakdown');
  const memberHeaders = ['Member', 'Amount Paid', 'Expense Share', 'Net Balance', 'Share %'];
  const memberWidths = [155, 90, 90, 100, 80];
  const memberRows = data.memberBreakdown.map((m) => [
    m.name,
    `Rs. ${m.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Rs. ${m.expenseShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `${m.netBalance >= 0 ? '+' : ''}Rs. ${m.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `${m.percentShare.toFixed(1)}%`,
  ]);
  builder.drawTable(memberHeaders, memberWidths, memberRows, ['left', 'right', 'right', 'right', 'right']);

  // 4. Category-wise Group Spending
  builder.drawSectionTitle('3. Category-wise Group Spending');
  const catHeaders = ['Category', 'Total Amount', 'Percentage'];
  const catWidths = [275, 120, 120];
  const catRows = data.categoryBreakdown.map((c) => [
    c.label,
    `Rs. ${c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `${c.percentage.toFixed(1)}%`,
  ]);
  builder.drawTable(catHeaders, catWidths, catRows, ['left', 'right', 'right']);

  // 5. Detailed Expense Transactions
  builder.drawSectionTitle('4. Detailed Expense Transactions');
  const expHeaders = ['Date', 'Description', 'Category', 'Paid By', 'Amount', 'Participants'];
  const expWidths = [65, 120, 80, 80, 70, 100];
  const expRows = data.expenses.map((e) => [
    e.date,
    e.title,
    e.category,
    e.paidByName,
    `Rs. ${e.totalAmount.toFixed(2)}`,
    `${e.participantsCount} members`,
  ]);
  builder.drawTable(expHeaders, expWidths, expRows, ['left', 'left', 'left', 'left', 'right', 'left']);

  // 6. Settlement History
  builder.drawSectionTitle('5. Settlement History');
  const setHeaders = ['Date', 'Sender (From)', 'Receiver (To)', 'Amount', 'Status'];
  const setWidths = [80, 140, 140, 85, 70];
  const setRows = data.settlements.map((s) => [
    s.date,
    s.fromName,
    s.toName,
    `Rs. ${s.amount.toFixed(2)}`,
    s.status,
  ]);
  builder.drawTable(setHeaders, setWidths, setRows, ['left', 'left', 'left', 'right', 'left']);

  return await builder.finish();
}

// ============================================================================
// File Export & Sharing (Android-Compatible Workflow)
// ============================================================================

const DOWNLOAD_DIR_STORAGE_KEY = '@splitmate_reports_download_dir';

export interface DownloadReportResult {
  success: boolean;
  filePath?: string;
  downloadedUri?: string;
  cancelled?: boolean;
  error?: string;
}

/**
 * Downloads/saves the report file directly to device storage (e.g. Android Downloads folder).
 * Uses StorageAccessFramework on Android so the file is stored in public user storage.
 */
export async function downloadReportToDevice(
  filename: string,
  content: string,
  format: ReportFormat
): Promise<DownloadReportResult> {
  try {
    const dir = `${FileSystem.cacheDirectory}reports/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const localFilePath = `${dir}${filename}`;

    // 1. Write the file to local cache first
    if (format === 'csv') {
      await FileSystem.writeAsStringAsync(localFilePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      await FileSystem.writeAsStringAsync(localFilePath, content, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    // 2. On Android, save directly to device storage using StorageAccessFramework
    if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const fileNameWithoutExt = filename.replace(/\.(pdf|csv)$/i, '');

      let targetDirUri = await AsyncStorage.getItem(DOWNLOAD_DIR_STORAGE_KEY);
      let newFileUri: string | null = null;

      // Try with existing saved directory permission if available
      if (targetDirUri) {
        try {
          newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            targetDirUri,
            fileNameWithoutExt,
            mimeType
          );
        } catch (e) {
          // If saved permission is no longer valid, reset it
          targetDirUri = null;
          await AsyncStorage.removeItem(DOWNLOAD_DIR_STORAGE_KEY);
        }
      }

      // If no valid target directory yet, request directory access from user
      if (!newFileUri) {
        const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);

        if (!permissions.granted) {
          return { success: false, cancelled: true, filePath: localFilePath };
        }

        targetDirUri = permissions.directoryUri;
        await AsyncStorage.setItem(DOWNLOAD_DIR_STORAGE_KEY, targetDirUri);

        newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          targetDirUri,
          fileNameWithoutExt,
          mimeType
        );
      }

      // Write to the destination SAF URI
      if (format === 'csv') {
        await FileSystem.writeAsStringAsync(newFileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        await FileSystem.writeAsStringAsync(newFileUri, content, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      return {
        success: true,
        filePath: localFilePath,
        downloadedUri: newFileUri,
      };
    }

    // 3. Fallback for iOS or non-Android environments:
    const docDir = `${FileSystem.documentDirectory}reports/`;
    await FileSystem.makeDirectoryAsync(docDir, { intermediates: true });
    const permanentPath = `${docDir}${filename}`;
    if (format === 'csv') {
      await FileSystem.writeAsStringAsync(permanentPath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      await FileSystem.writeAsStringAsync(permanentPath, content, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    return {
      success: true,
      filePath: permanentPath,
    };
  } catch (error: any) {
    console.error('[ReportService] Download to device error:', error);
    return { success: false, error: error?.message || 'Failed to download report file.' };
  }
}

/**
 * Shares the report file using the system share sheet (e.g. WhatsApp, Email, Drive).
 */
export async function shareReportFile(
  filename: string,
  content: string,
  format: ReportFormat
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const dir = `${FileSystem.cacheDirectory}reports/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const filePath = `${dir}${filename}`;

    if (format === 'csv') {
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
        dialogTitle: `Share Financial Report (${filename})`,
        UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
      });
    }

    return { success: true, filePath };
  } catch (error: any) {
    console.error('[ReportService] Share report error:', error);
    return { success: false, error: error?.message || 'Failed to share report file.' };
  }
}

export const exportAndShareReport = shareReportFile;
