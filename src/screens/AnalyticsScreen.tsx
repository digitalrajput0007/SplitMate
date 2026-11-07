import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { db, auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import {
  ExpenseData,
  GroupData,
  SettlementData,
  getEffectiveSplitDetails,
  formatCurrency,
  subscribeToAcceptedMembers,
  subscribeToUserProfile,
  UserProfile,
} from '../services/firestoreService';
import {
  parseFirestoreDate,
  formatFirestoreDate,
  getCurrentBillingMonth,
  getExpenseBillingMonth,
} from '../utils/dateUtils';
import { useUserGroups } from '../hooks/useUserGroups';
import { RootStackParamList } from '../navigation/types';

import {
  InteractiveDonutChart,
  DonutDataItem,
} from '../components/charts/InteractiveDonutChart';
import {
  TrendAreaChart,
  MonthlyTrendItem,
} from '../components/charts/TrendAreaChart';
import {
  HorizontalBarChart,
  GroupSpendingItem,
} from '../components/charts/HorizontalBarChart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DateRangeFilter = 'this_month' | 'last_month' | 'last_3_months' | 'all_time';
type MemberViewMode = 'paid' | 'share';

interface CategorySummary {
  category: string;
  label: string;
  icon: string;
  color: string;
  totalAmount: number;
  userShare: number;
  percentage: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  food: { label: 'Food & Dining', icon: 'restaurant', color: '#F97316' },
  travel: { label: 'Travel & Transport', icon: 'directions-car', color: '#0EA5E9' },
  rent: { label: 'Rent & Housing', icon: 'home', color: '#8B5CF6' },
  fun: { label: 'Entertainment & Fun', icon: 'movie', color: '#EC4899' },
  shopping: { label: 'Shopping', icon: 'shopping-bag', color: '#10B981' },
  health: { label: 'Health & Medical', icon: 'medical-services', color: '#EF4444' },
  other: { label: 'Other', icon: 'category', color: '#64748B' },
};

const MEMBER_PALETTE = [
  '#0EA5E9', // Sky Blue (Primary)
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#E11D48', // Rose
];

function normalizeCategory(rawCat: string = ''): { key: string; label: string; icon: string; color: string } {
  const clean = rawCat.toLowerCase().trim();
  if (clean.includes('food') || clean.includes('🍕') || clean.includes('dining')) return { key: 'food', ...CATEGORY_META['food'] };
  if (clean.includes('travel') || clean.includes('🚕') || clean.includes('cab') || clean.includes('trip')) return { key: 'travel', ...CATEGORY_META['travel'] };
  if (clean.includes('rent') || clean.includes('🏠') || clean.includes('house') || clean.includes('stay')) return { key: 'rent', ...CATEGORY_META['rent'] };
  if (clean.includes('fun') || clean.includes('🎬') || clean.includes('movie') || clean.includes('party')) return { key: 'fun', ...CATEGORY_META['fun'] };
  if (clean.includes('shop') || clean.includes('🛒') || clean.includes('grocer')) return { key: 'shopping', ...CATEGORY_META['shopping'] };
  if (clean.includes('health') || clean.includes('💊') || clean.includes('med')) return { key: 'health', ...CATEGORY_META['health'] };
  return { key: 'other', ...CATEGORY_META['other'] };
}

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || '';

  const { activeGroups, groupBalances, loading: groupsLoading } = useUserGroups();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('this_month');
  const [memberViewMode, setMemberViewMode] = useState<MemberViewMode>('paid');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [trendViewMonths, setTrendViewMonths] = useState<6 | 12>(6);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  const [allExpenses, setAllExpenses] = useState<ExpenseData[]>([]);
  const [allSettlements, setAllSettlements] = useState<SettlementData[]>([]);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Group Map for quick lookup
  const groupMap = useMemo(() => {
    const map = new Map<string, GroupData>();
    activeGroups.forEach((g) => {
      if (g.groupId) map.set(g.groupId, g);
    });
    return map;
  }, [activeGroups]);

  // Load member profiles if an individual group is selected
  useEffect(() => {
    if (selectedGroupId === 'all' || !selectedGroupId) {
      setGroupMembers([]);
      return;
    }
    const unsub = subscribeToAcceptedMembers(selectedGroupId, (acceptedMembers: UserProfile[]) => {
      setGroupMembers(acceptedMembers);
    });
    return () => unsub();
  }, [selectedGroupId]);

  // Continuously listen to user profiles across all active groups and expenses
  useEffect(() => {
    if (activeGroups.length === 0 && allExpenses.length === 0) return;

    const uidsToFetch = new Set<string>();

    activeGroups.forEach((g) => {
      if (g.memberIds) {
        g.memberIds.forEach((uid) => {
          if (uid) uidsToFetch.add(uid);
        });
      }
      if (g.membersDetails) {
        g.membersDetails.forEach((m) => {
          if (m.uid) uidsToFetch.add(m.uid);
        });
      }
      if (g.memberProfiles) {
        Object.keys(g.memberProfiles).forEach((uid) => {
          if (uid) uidsToFetch.add(uid);
        });
      }
    });

    allExpenses.forEach((exp) => {
      if (exp.paidBy) uidsToFetch.add(exp.paidBy);
      if (exp.splitDetails) {
        Object.keys(exp.splitDetails).forEach((uid) => {
          if (uid) uidsToFetch.add(uid);
        });
      }
    });

    const unsubs: (() => void)[] = [];
    uidsToFetch.forEach((uid) => {
      if (!allUsersMap.has(uid)) {
        const unsub = subscribeToUserProfile(uid, (profile) => {
          if (profile) {
            setAllUsersMap((prev) => {
              const next = new Map(prev);
              next.set(uid, profile);
              return next;
            });
          }
        });
        unsubs.push(unsub);
      }
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeGroups, allExpenses, allUsersMap]);

  // Always subscribe to expenses and settlements across all active groups
  useEffect(() => {
    if (groupsLoading) return;

    const allActiveGroupIds = activeGroups
      .map((g) => g.groupId)
      .filter((id): id is string => !!id);

    if (allActiveGroupIds.length === 0) {
      setAllExpenses([]);
      setAllSettlements([]);
      setExpensesLoading(false);
      return;
    }

    setExpensesLoading(true);

    // Batch in chunks of 30 for Firestore 'in' query limit
    const chunks: string[][] = [];
    for (let i = 0; i < allActiveGroupIds.length; i += 30) {
      chunks.push(allActiveGroupIds.slice(i, i + 30));
    }

    const chunkExpResults = new Map<number, ExpenseData[]>();
    const chunkSetResults = new Map<number, SettlementData[]>();
    const unsubs: (() => void)[] = [];

    chunks.forEach((chunk, idx) => {
      const q = query(collection(db, 'expenses'), where('groupId', 'in', chunk));
      const setQ = query(collection(db, 'settlements'), where('groupId', 'in', chunk));

      const unsubExp = onSnapshot(
        q,
        (snapshot) => {
          const list: ExpenseData[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as ExpenseData;
            // Exclude soft-deleted expenses
            if (!(data as any).isDeleted) {
              list.push({ ...data, expenseId: doc.id });
            }
          });
          chunkExpResults.set(idx, list);

          const combined = Array.from(chunkExpResults.values()).flat();
          setAllExpenses(combined);
          setExpensesLoading(false);
          setRefreshing(false);
        },
        (err) => {
          console.warn('[AnalyticsScreen] Expenses listener error:', err);
          setExpensesLoading(false);
          setRefreshing(false);
        }
      );

      const unsubSet = onSnapshot(
        setQ,
        (snapshot) => {
          const list: SettlementData[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data() as SettlementData;
            list.push({ ...data, settlementId: doc.id });
          });
          chunkSetResults.set(idx, list);
          setAllSettlements(Array.from(chunkSetResults.values()).flat());
        },
        (err) => {
          console.warn('[AnalyticsScreen] Settlements listener error:', err);
        }
      );

      unsubs.push(unsubExp);
      unsubs.push(unsubSet);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeGroups, groupsLoading]);

  // Canonical month identifiers for bulletproof date range filtering
  const { currentMonthKey, lastMonthKey, last3MonthsKeys } = useMemo(() => {
    const now = new Date();
    const currentMonthKey = getCurrentBillingMonth();

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoKey = `${twoMonthsAgoDate.getFullYear()}-${String(twoMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      currentMonthKey,
      lastMonthKey,
      last3MonthsKeys: [currentMonthKey, lastMonthKey, twoMonthsAgoKey],
    };
  }, []);

  const matchesDateFilter = useCallback(
    (item: { billingMonth?: string; date?: string; createdAt?: any }) => {
      const bMonth = getExpenseBillingMonth(item);
      switch (dateFilter) {
        case 'this_month':
          return bMonth === currentMonthKey;
        case 'last_month':
          return bMonth === lastMonthKey;
        case 'last_3_months':
          return last3MonthsKeys.includes(bMonth);
        case 'all_time':
        default:
          return true;
      }
    },
    [dateFilter, currentMonthKey, lastMonthKey, last3MonthsKeys]
  );

  // Filter expenses by selected group and selected date range
  const filteredExpenses = useMemo(() => {
    return allExpenses
      .filter((exp) => selectedGroupId === 'all' || exp.groupId === selectedGroupId)
      .filter(matchesDateFilter);
  }, [allExpenses, selectedGroupId, matchesDateFilter]);

  // Filter settlements by selected group and selected date range
  const filteredSettlements = useMemo(() => {
    return allSettlements
      .filter((s) => selectedGroupId === 'all' || s.groupId === selectedGroupId)
      .filter(matchesDateFilter);
  }, [allSettlements, selectedGroupId, matchesDateFilter]);

  // Overview metrics calculations
  const overviewMetrics = useMemo(() => {
    let totalSpending = 0;
    let youPaid = 0;
    let yourShare = 0;

    filteredExpenses.forEach((exp) => {
      const group = groupMap.get(exp.groupId);
      const joinedAt = group?.membersJoinedAt?.[currentUid];
      const includeExisting = group?.memberExistingExpensesPreference?.[currentUid] ?? true;
      const expTime = exp.createdAt?.seconds
        ? exp.createdAt.seconds * 1000
        : parseFirestoreDate(exp.createdAt, exp.date).getTime();
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
  }, [filteredExpenses, filteredSettlements, groupMap, currentUid]);

  // Member Spending Breakdown: Amount Paid vs Expense Share with Profile Photos
  const memberDonutData = useMemo((): DonutDataItem[] => {
    const memberMap = new Map<
      string,
      {
        paid: number;
        share: number;
        name: string;
        photoUrl?: string;
        photoThumbnailUrl?: string;
        isCurrentUser: boolean;
      }
    >();

    // Helper to find photo across profiles
    const resolveMemberPhoto = (uid: string) => {
      if (uid === currentUid && currentUser?.photoURL) {
        return { photoUrl: currentUser.photoURL, photoThumbnailUrl: undefined };
      }
      const user = allUsersMap.get(uid);
      if (user?.photoUrl || user?.photoThumbnailUrl) {
        return { photoUrl: user.photoUrl, photoThumbnailUrl: user.photoThumbnailUrl };
      }
      const p = groupMembers.find((m) => m.uid === uid);
      if (p?.photoUrl || p?.photoThumbnailUrl) {
        return { photoUrl: p.photoUrl, photoThumbnailUrl: p.photoThumbnailUrl };
      }
      for (const g of activeGroups) {
        const md = g.membersDetails?.find((m) => m.uid === uid);
        if (md?.photoUrl || md?.photoThumbnailUrl) {
          return { photoUrl: md.photoUrl, photoThumbnailUrl: md.photoThumbnailUrl };
        }
        const mp = g.memberProfiles?.[uid];
        if (mp?.photoUrl || mp?.photoThumbnailUrl) {
          return { photoUrl: mp.photoUrl, photoThumbnailUrl: mp.photoThumbnailUrl };
        }
      }
      return { photoUrl: undefined, photoThumbnailUrl: undefined };
    };

    // Helper to find member name
    const resolveMemberName = (uid: string, fallback = 'Member') => {
      if (uid === currentUid) return 'You';
      const user = allUsersMap.get(uid);
      if (user?.name) return user.name;
      const p = groupMembers.find((m) => m.uid === uid);
      if (p?.name) return p.name;
      for (const g of activeGroups) {
        const md = g.membersDetails?.find((m) => m.uid === uid);
        if (md?.name) return md.name;
        const mp = g.memberProfiles?.[uid];
        if (mp?.name) return mp.name;
      }
      return fallback;
    };

    // If an individual group is selected, initialize all known members
    if (selectedGroupId !== 'all') {
      const currentGroup = groupMap.get(selectedGroupId);
      if (currentGroup?.memberIds) {
        currentGroup.memberIds.forEach((uid) => {
          const name = resolveMemberName(uid, 'Member');
          const { photoUrl, photoThumbnailUrl } = resolveMemberPhoto(uid);
          memberMap.set(uid, {
            paid: 0,
            share: 0,
            name,
            photoUrl,
            photoThumbnailUrl,
            isCurrentUser: uid === currentUid,
          });
        });
      }
    }

    filteredExpenses.forEach((exp) => {
      // 1. Accumulate Paid
      const payerUid = exp.paidBy;
      if (payerUid) {
        const name = resolveMemberName(payerUid, exp.paidByName || 'Member');
        const { photoUrl, photoThumbnailUrl } = resolveMemberPhoto(payerUid);
        const existing = memberMap.get(payerUid) || {
          paid: 0,
          share: 0,
          name,
          photoUrl,
          photoThumbnailUrl,
          isCurrentUser: payerUid === currentUid,
        };
        existing.paid += Number(exp.amount) || 0;
        memberMap.set(payerUid, existing);
      }

      // 2. Accumulate Share
      const group = groupMap.get(exp.groupId);
      const splits = getEffectiveSplitDetails(exp, group);

      Object.entries(splits).forEach(([mUid, splitAmt]) => {
        const joinedAt = group?.membersJoinedAt?.[mUid];
        const includeExisting = group?.memberExistingExpensesPreference?.[mUid] ?? true;
        const expTime = exp.createdAt?.seconds
          ? exp.createdAt.seconds * 1000
          : parseFirestoreDate(exp.createdAt, exp.date).getTime();
        const isExcludedPreJoin = !includeExisting && joinedAt && expTime < joinedAt;

        if (!isExcludedPreJoin && Number(splitAmt) > 0) {
          const name = resolveMemberName(mUid, 'Member');
          const { photoUrl, photoThumbnailUrl } = resolveMemberPhoto(mUid);
          const existing = memberMap.get(mUid) || {
            paid: 0,
            share: 0,
            name,
            photoUrl,
            photoThumbnailUrl,
            isCurrentUser: mUid === currentUid,
          };
          existing.share += Number(splitAmt) || 0;
          memberMap.set(mUid, existing);
        }
      });
    });

    const entries = Array.from(memberMap.entries());

    // Sort: 'You' first, then highest contribution
    entries.sort((a, b) => {
      if (a[1].isCurrentUser) return -1;
      if (b[1].isCurrentUser) return 1;
      const valA = memberViewMode === 'paid' ? a[1].paid : a[1].share;
      const valB = memberViewMode === 'paid' ? b[1].paid : b[1].share;
      return valB - valA;
    });

    return entries.map(([uid, info], idx) => {
      const color = info.isCurrentUser
        ? colors.primary
        : MEMBER_PALETTE[(idx % (MEMBER_PALETTE.length - 1)) + 1];

      const val = memberViewMode === 'paid' ? info.paid : info.share;
      const secVal = memberViewMode === 'paid' ? info.share : info.paid;
      const secLabel = memberViewMode === 'paid' ? 'Expense Share' : 'Amount Paid';

      return {
        id: uid,
        label: info.name,
        value: Math.round(val * 100) / 100,
        color,
        photoUrl: info.photoUrl,
        photoThumbnailUrl: info.photoThumbnailUrl,
        isCurrentUser: info.isCurrentUser,
        secondaryAmount: Math.round(secVal * 100) / 100,
        secondaryLabel: secLabel,
        initials: info.name.charAt(0).toUpperCase(),
      };
    });
  }, [
    filteredExpenses,
    selectedGroupId,
    groupMap,
    groupMembers,
    activeGroups,
    currentUid,
    currentUser?.photoURL,
    colors.primary,
    memberViewMode,
    allUsersMap,
  ]);

  // Monthly trends (6M or 12M view)
  const monthlyTrends = useMemo((): MonthlyTrendItem[] => {
    const now = new Date();
    const months: MonthlyTrendItem[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const count = trendViewMonths;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      months.push({
        monthKey,
        label: monthNames[m],
        year: y,
        month: m,
        totalSpend: 0,
        userShare: 0,
      });
    }

    allExpenses.forEach((exp) => {
      if (selectedGroupId !== 'all' && exp.groupId !== selectedGroupId) return;

      const bMonth = getExpenseBillingMonth(exp);
      const group = groupMap.get(exp.groupId);
      const joinedAt = group?.membersJoinedAt?.[currentUid];
      const includeExisting = group?.memberExistingExpensesPreference?.[currentUid] ?? true;
      const expTime = exp.createdAt?.seconds
        ? exp.createdAt.seconds * 1000
        : parseFirestoreDate(exp.createdAt, exp.date).getTime();
      const isExcludedPreJoin = !includeExisting && joinedAt && expTime < joinedAt;

      const splits = getEffectiveSplitDetails(exp, group);
      const expAmount = Number(exp.amount) || 0;
      const userShare = !isExcludedPreJoin && splits[currentUid] ? Number(splits[currentUid]) || 0 : 0;

      const target = months.find((m) => m.monthKey === bMonth);
      if (target) {
        target.totalSpend += expAmount;
        target.userShare += userShare;
      }
    });

    return months;
  }, [allExpenses, selectedGroupId, groupMap, currentUid, trendViewMonths]);

  // Month-over-month comparison (Current vs Previous)
  const monthComparison = useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    const currentMonthData = monthlyTrends[monthlyTrends.length - 1];
    const prevMonthData = monthlyTrends[monthlyTrends.length - 2];

    const currentVal = currentMonthData.totalSpend;
    const prevVal = prevMonthData.totalSpend;

    if (prevVal === 0) {
      if (currentVal === 0) return { changePercent: 0, direction: 'flat' as const, prevVal, currentVal };
      return { changePercent: 100, direction: 'up' as const, prevVal, currentVal };
    }

    const diff = currentVal - prevVal;
    const percent = Math.round((Math.abs(diff) / prevVal) * 100);
    const direction = diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('flat' as const);

    return {
      changePercent: percent,
      direction,
      prevVal,
      currentVal,
    };
  }, [monthlyTrends]);

  // Category breakdown
  const categoryBreakdown = useMemo((): CategorySummary[] => {
    const catMap = new Map<string, { total: number; userShare: number }>();

    filteredExpenses.forEach((exp) => {
      const norm = normalizeCategory(exp.category);
      const existing = catMap.get(norm.key) || { total: 0, userShare: 0 };
      const group = groupMap.get(exp.groupId);
      const splits = getEffectiveSplitDetails(exp, group);

      existing.total += Number(exp.amount) || 0;
      if (splits[currentUid]) {
        existing.userShare += Number(splits[currentUid]) || 0;
      }
      catMap.set(norm.key, existing);
    });

    const totalAllCategories = overviewMetrics.totalSpending || 1;
    const result: CategorySummary[] = [];

    catMap.forEach((val, key) => {
      const meta = CATEGORY_META[key] || CATEGORY_META['other'];
      const pct = Math.round((val.total / totalAllCategories) * 100);
      result.push({
        category: key,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        totalAmount: Math.round(val.total * 100) / 100,
        userShare: Math.round(val.userShare * 100) / 100,
        percentage: pct,
      });
    });

    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredExpenses, groupMap, currentUid, overviewMetrics.totalSpending]);

  const categoryDonutData = useMemo((): DonutDataItem[] => {
    return categoryBreakdown.map((cat) => ({
      id: cat.category,
      label: cat.label,
      value: cat.totalAmount,
      color: cat.color,
      icon: cat.icon,
      secondaryAmount: cat.userShare,
      secondaryLabel: 'Your Share',
    }));
  }, [categoryBreakdown]);

  // Group Spending Comparison across ALL active groups for the selected date filter
  const allGroupsBreakdown = useMemo((): GroupSpendingItem[] => {
    const breakdownMap = new Map<
      string,
      {
        totalSpend: number;
        userShare: number;
        groupName: string;
        groupPhotoUrl?: string;
        groupPhotoThumbnailUrl?: string;
        members: Array<{ uid?: string; name: string; photoUrl?: string; photoThumbnailUrl?: string }>;
      }
    >();

    activeGroups.forEach((g) => {
      if (g.groupId) {
        const membersList: Array<{ uid?: string; name: string; photoUrl?: string; photoThumbnailUrl?: string }> = [];
        const uidsInGroup = new Set<string>();

        if (g.memberIds && g.memberIds.length > 0) {
          g.memberIds.forEach((uid) => uidsInGroup.add(uid));
        }
        if (g.membersDetails && g.membersDetails.length > 0) {
          g.membersDetails.forEach((m) => {
            if (m.uid) uidsInGroup.add(m.uid);
          });
        }
        if (g.memberProfiles) {
          Object.keys(g.memberProfiles).forEach((uid) => uidsInGroup.add(uid));
        }

        uidsInGroup.forEach((uid) => {
          const user = allUsersMap.get(uid);
          const isMe = uid === currentUid;
          const name = isMe
            ? 'You'
            : user?.name ||
              g.membersDetails?.find((m) => m.uid === uid)?.name ||
              g.memberProfiles?.[uid]?.name ||
              'Member';
          const photoUrl = isMe
            ? currentUser?.photoURL || user?.photoUrl
            : user?.photoUrl ||
              g.membersDetails?.find((m) => m.uid === uid)?.photoUrl ||
              g.memberProfiles?.[uid]?.photoUrl;
          const photoThumbnailUrl =
            user?.photoThumbnailUrl ||
            g.membersDetails?.find((m) => m.uid === uid)?.photoThumbnailUrl ||
            g.memberProfiles?.[uid]?.photoThumbnailUrl;

          membersList.push({ uid, name, photoUrl, photoThumbnailUrl });
        });

        breakdownMap.set(g.groupId, {
          totalSpend: 0,
          userShare: 0,
          groupName: g.name || 'Unnamed Group',
          groupPhotoUrl: g.photoUrl,
          groupPhotoThumbnailUrl: g.photoThumbnailUrl,
          members: membersList,
        });
      }
    });

    // Always use allExpenses filtered by dateFilter so comparison across groups is complete
    const dateFilteredAllExpenses = allExpenses.filter(matchesDateFilter);

    dateFilteredAllExpenses.forEach((exp) => {
      const item = breakdownMap.get(exp.groupId);
      if (item) {
        item.totalSpend += Number(exp.amount) || 0;
        const group = groupMap.get(exp.groupId);
        const splits = getEffectiveSplitDetails(exp, group);
        if (splits[currentUid]) {
          item.userShare += Number(splits[currentUid]) || 0;
        }
      }
    });

    return Array.from(breakdownMap.entries())
      .map(([gId, info]) => ({
        groupId: gId,
        groupName: info.groupName,
        groupPhotoUrl: info.groupPhotoUrl,
        groupPhotoThumbnailUrl: info.groupPhotoThumbnailUrl,
        members: info.members,
        totalSpend: Math.round(info.totalSpend * 100) / 100,
        userShare: Math.round(info.userShare * 100) / 100,
        balance: groupBalances[gId] || 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [
    activeGroups,
    allExpenses,
    matchesDateFilter,
    groupMap,
    currentUid,
    currentUser?.photoURL,
    groupBalances,
    allUsersMap,
  ]);

  // Top 3 highest expenses in selected group & period
  const topExpenses = useMemo(() => {
    if (selectedGroupId === 'all') return [];
    return [...filteredExpenses]
      .filter((exp) => exp.groupId === selectedGroupId)
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 3);
  }, [selectedGroupId, filteredExpenses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleAddExpense = () => {
    if (selectedGroupId !== 'all') {
      const group = groupMap.get(selectedGroupId);
      navigation.navigate('AddExpense', {
        groupId: selectedGroupId,
        groupName: group?.name || 'Group',
      });
    } else {
      navigation.navigate('AddExpense');
    }
  };

  const handleSelectGroupFilter = (gId: string) => {
    setSelectedGroupId(gId);
    setSelectedMemberId(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            backgroundColor: colors.surfaceContainerLowest,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {navigation.canGoBack() && (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.headerBackBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            )}
            <View>
              <Text style={[styles.screenTitle, { color: colors.onSurface }]}>Analytics</Text>
              <Text style={[styles.screenSubtitle, { color: colors.onSurfaceVariant }]}>
                Insights & Spending Breakdown
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.primary + '18' }]}
            onPress={handleAddExpense}
            activeOpacity={0.7}
            accessibilityLabel="Add Expense"
          >
            <MaterialIcons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Group Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipScroll}
          style={styles.groupScrollContainer}
        >
          <TouchableOpacity
            style={[
              styles.groupChip,
              selectedGroupId === 'all'
                ? [styles.groupChipActive, { backgroundColor: colors.primary }]
                : [
                    styles.groupChipInactive,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.divider,
                    },
                  ],
            ]}
            onPress={() => handleSelectGroupFilter('all')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="pie-chart"
              size={15}
              color={selectedGroupId === 'all' ? colors.onPrimary : colors.onSurfaceVariant}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.groupChipText,
                { color: selectedGroupId === 'all' ? colors.onPrimary : colors.onSurface },
              ]}
            >
              All Groups ({activeGroups.length})
            </Text>
          </TouchableOpacity>

          {activeGroups.map((g) => {
            const isSelected = selectedGroupId === g.groupId;
            return (
              <TouchableOpacity
                key={g.groupId}
                style={[
                  styles.groupChip,
                  isSelected
                    ? [styles.groupChipActive, { backgroundColor: colors.primary }]
                    : [
                        styles.groupChipInactive,
                        {
                          backgroundColor: colors.surfaceContainerLow,
                          borderColor: colors.divider,
                        },
                      ],
                ]}
                onPress={() => handleSelectGroupFilter(g.groupId)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="group"
                  size={15}
                  color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.groupChipText,
                    { color: isSelected ? colors.onPrimary : colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {g.name || 'Group'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. Date Range Filter Bar */}
        <View style={[styles.dateFilterContainer, { borderTopColor: colors.divider }]}>
          {(
            [
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_3_months', label: 'Last 3M' },
              { id: 'all_time', label: 'All Time' },
            ] as const
          ).map((item) => {
            const isActive = dateFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.dateFilterTab,
                  isActive && [
                    styles.dateFilterTabActive,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '14',
                    },
                  ],
                ]}
                onPress={() => setDateFilter(item.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateFilterText,
                    { color: isActive ? colors.primary : colors.onSurfaceVariant },
                    isActive && styles.dateFilterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content Area */}
      {groupsLoading || expensesLoading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loaderText, { color: colors.onSurfaceVariant }]}>
            Calculating analytics...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* 3. Overview Summary Cards */}
          <View style={styles.metricsGrid}>
            {/* Card 1: Total Spending */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
              ]}
            >
              <View style={styles.metricCardTop}>
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                  Total Spending
                </Text>
                <View style={[styles.metricIconWrap, { backgroundColor: '#0284C7' + '18' }]}>
                  <MaterialIcons name="account-balance" size={16} color="#0284C7" />
                </View>
              </View>
              <Text style={[styles.metricAmount, { color: colors.onSurface }]}>
                {formatCurrency(overviewMetrics.totalSpending)}
              </Text>
              <Text style={[styles.metricSubtext, { color: colors.onSurfaceVariant }]}>
                {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>

            {/* Card 2: You Paid */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
              ]}
            >
              <View style={styles.metricCardTop}>
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                  You Paid
                </Text>
                <View style={[styles.metricIconWrap, { backgroundColor: '#8B5CF6' + '18' }]}>
                  <MaterialIcons name="payment" size={16} color="#8B5CF6" />
                </View>
              </View>
              <Text style={[styles.metricAmount, { color: colors.onSurface }]}>
                {formatCurrency(overviewMetrics.youPaid)}
              </Text>
              <Text style={[styles.metricSubtext, { color: colors.onSurfaceVariant }]}>
                Out of pocket
              </Text>
            </View>

            {/* Card 3: Your Share */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
              ]}
            >
              <View style={styles.metricCardTop}>
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                  Your Share
                </Text>
                <View style={[styles.metricIconWrap, { backgroundColor: '#0EA5E9' + '18' }]}>
                  <MaterialIcons name="person" size={16} color="#0EA5E9" />
                </View>
              </View>
              <Text style={[styles.metricAmount, { color: colors.onSurface }]}>
                {formatCurrency(overviewMetrics.yourShare)}
              </Text>
              <Text style={[styles.metricSubtext, { color: colors.onSurfaceVariant }]}>
                Actual liability
              </Text>
            </View>

            {/* Card 4: Net Balance */}
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor:
                    overviewMetrics.netBalance > 0
                      ? '#10B981'
                      : overviewMetrics.netBalance < 0
                      ? '#F59E0B'
                      : colors.divider,
                },
              ]}
            >
              <View style={styles.metricCardTop}>
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                  Net Balance
                </Text>
                <View
                  style={[
                    styles.metricIconWrap,
                    {
                      backgroundColor:
                        overviewMetrics.netBalance >= 0 ? '#10B981' + '18' : '#F59E0B' + '18',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      overviewMetrics.netBalance > 0
                        ? 'trending-up'
                        : overviewMetrics.netBalance < 0
                        ? 'trending-down'
                        : 'check'
                    }
                    size={16}
                    color={overviewMetrics.netBalance >= 0 ? '#10B981' : '#F59E0B'}
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.metricAmount,
                  {
                    color:
                      overviewMetrics.netBalance > 0
                        ? '#10B981'
                        : overviewMetrics.netBalance < 0
                        ? '#F59E0B'
                        : colors.onSurface,
                  },
                ]}
              >
                {overviewMetrics.netBalance === 0
                  ? '₹0'
                  : formatCurrency(Math.abs(overviewMetrics.netBalance))}
              </Text>
              <Text
                style={[
                  styles.metricSubtext,
                  {
                    color:
                      overviewMetrics.netBalance > 0
                        ? '#10B981'
                        : overviewMetrics.netBalance < 0
                        ? '#F59E0B'
                        : colors.onSurfaceVariant,
                    fontWeight: '600',
                  },
                ]}
              >
                {overviewMetrics.netBalance > 0
                  ? 'You are owed'
                  : overviewMetrics.netBalance < 0
                  ? 'You owe'
                  : 'Settled up'}
              </Text>
            </View>
          </View>

          {/* Empty State Banner if no expenses in range */}
          {filteredExpenses.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
              ]}
            >
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '18' }]}>
                <MaterialIcons name="insights" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                No expenses in this period
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                {selectedGroupId !== 'all'
                  ? 'Add your first expense to this group to see interactive member breakdowns, category charts, and spending trends.'
                  : 'Record expenses across your groups to unlock monthly trends, member contributions, and category breakdowns.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddExpense}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="add"
                  size={18}
                  color={colors.onPrimary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.emptyAddBtnText, { color: colors.onPrimary }]}>
                  Add Expense
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 4. Priority Feature: Member Spending Breakdown Donut Chart */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1, marginRight: Spacing.xs }}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                      Member Spending Breakdown
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                      {selectedGroupId !== 'all'
                        ? `Contributions for ${groupMap.get(selectedGroupId)?.name || 'Group'}`
                        : 'Contributions across active groups'}
                    </Text>
                  </View>

                  {/* Amount Paid vs Expense Share Toggle */}
                  <View
                    style={[
                      styles.toggleWrap,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.divider,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.togglePill,
                        memberViewMode === 'paid' && [
                          styles.togglePillActive,
                          { backgroundColor: colors.primary },
                        ],
                      ]}
                      onPress={() => setMemberViewMode('paid')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          {
                            color:
                              memberViewMode === 'paid'
                                ? colors.onPrimary
                                : colors.onSurfaceVariant,
                            fontWeight: memberViewMode === 'paid' ? '700' : '500',
                          },
                        ]}
                      >
                        Amount Paid
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.togglePill,
                        memberViewMode === 'share' && [
                          styles.togglePillActive,
                          { backgroundColor: colors.primary },
                        ],
                      ]}
                      onPress={() => setMemberViewMode('share')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          {
                            color:
                              memberViewMode === 'share'
                                ? colors.onPrimary
                                : colors.onSurfaceVariant,
                            fontWeight: memberViewMode === 'share' ? '700' : '500',
                          },
                        ]}
                      >
                        Expense Share
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Donut Chart */}
                <InteractiveDonutChart
                  data={memberDonutData}
                  totalValue={overviewMetrics.totalSpending}
                  centerTitle={memberViewMode === 'paid' ? 'Total Paid' : 'Total Share'}
                  centerSubtitle={`${memberDonutData.length} ${memberDonutData.length === 1 ? 'member' : 'members'}`}
                  selectedId={selectedMemberId}
                  onSelectId={setSelectedMemberId}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              {/* 5. Monthly Spending Trend (Area / Line Chart) */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                ]}
              >
                <TrendAreaChart
                  data={monthlyTrends}
                  viewMonths={trendViewMonths}
                  onChangeViewMonths={setTrendViewMonths}
                  selectedIndex={selectedMonthIndex}
                  onSelectIndex={setSelectedMonthIndex}
                  colors={colors}
                  isDark={isDark}
                  monthComparison={monthComparison}
                />
              </View>

              {/* 6. Category Breakdown Donut Chart */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                      Category Breakdown
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                      Spending distribution by activity
                    </Text>
                  </View>
                  <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant }]}>
                    {categoryBreakdown.length}{' '}
                    {categoryBreakdown.length === 1 ? 'category' : 'categories'}
                  </Text>
                </View>

                <InteractiveDonutChart
                  data={categoryDonutData}
                  totalValue={overviewMetrics.totalSpending}
                  centerTitle="Categories"
                  centerSubtitle={`${categoryBreakdown.length} active`}
                  selectedId={selectedCategoryKey}
                  onSelectId={setSelectedCategoryKey}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              {/* 7. Group Spending Comparison (Horizontal Bar Chart) */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                      Group Spending Comparison
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                      Total spending vs your share across groups
                    </Text>
                  </View>
                </View>

                <HorizontalBarChart
                  data={allGroupsBreakdown}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              {/* Top Expenses (for selected individual group) */}
              {selectedGroupId !== 'all' && topExpenses.length > 0 && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                        Top Expenses
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                        Highest recorded amounts in this period
                      </Text>
                    </View>
                  </View>

                  <View style={styles.topExpenseList}>
                    {topExpenses.map((exp, idx) => {
                      const norm = normalizeCategory(exp.category);
                      return (
                        <TouchableOpacity
                          key={exp.expenseId || String(idx)}
                          style={[
                            styles.topExpenseRow,
                            {
                              borderColor: colors.divider,
                              backgroundColor: colors.surfaceContainerLow,
                            },
                          ]}
                          onPress={() => navigation.navigate('ExpenseDetail', { expense: exp })}
                          activeOpacity={0.7}
                        >
                          <View style={styles.topExpenseLeft}>
                            <View
                              style={[
                                styles.topExpenseIcon,
                                { backgroundColor: norm.color + '18' },
                              ]}
                            >
                              <MaterialIcons name={norm.icon as any} size={18} color={norm.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[styles.topExpenseTitle, { color: colors.onSurface }]}
                                numberOfLines={1}
                              >
                                {exp.title}
                              </Text>
                              <Text
                                style={[
                                  styles.topExpenseMeta,
                                  { color: colors.onSurfaceVariant },
                                ]}
                              >
                                Paid by{' '}
                                {exp.paidByName ||
                                  (exp.paidBy === currentUid ? 'You' : 'Member')}{' '}
                                • {formatFirestoreDate(exp.createdAt, exp.date)}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[styles.topExpenseAmount, { color: colors.onSurface }]}>
                            {formatCurrency(exp.amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  screenTitle: {
    ...Typography.headlineSm,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    ...Typography.bodySm,
    fontSize: 12,
    marginTop: 2,
  },
  headerBackBtn: {
    padding: 4,
    marginLeft: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupScrollContainer: {
    marginBottom: Spacing.xs,
  },
  filterChipScroll: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minHeight: 32,
  },
  groupChipActive: {},
  groupChipInactive: {
    borderWidth: 1,
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 6,
    justifyContent: 'space-between',
    gap: 6,
  },
  dateFilterTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateFilterTabActive: {
    borderWidth: 1,
  },
  dateFilterText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateFilterTextActive: {
    fontWeight: '700',
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loaderText: {
    ...Typography.bodySm,
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm) / 2,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 94,
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricAmount: {
    fontSize: 17,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -0.2,
  },
  metricSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  emptyAddBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  sectionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.titleSm,
    fontWeight: '700',
    fontSize: 15,
  },
  sectionSubtitle: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 1,
  },
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    alignSelf: 'flex-start',
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  togglePillActive: {},
  togglePillText: {
    fontSize: 11,
  },
  categoryCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  topExpenseList: {
    gap: Spacing.xs,
  },
  topExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  topExpenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  topExpenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topExpenseTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  topExpenseMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  topExpenseAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
