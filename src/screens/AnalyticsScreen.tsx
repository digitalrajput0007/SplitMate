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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { db, auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import {
  ExpenseData,
  GroupData,
  SettlementData,
  getEffectiveSplitDetails,
  formatCurrency,
  subscribeToAcceptedMembers,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DateRangeFilter = 'this_month' | 'last_month' | 'last_3_months' | 'all_time';

interface CategorySummary {
  category: string;
  label: string;
  icon: string;
  color: string;
  totalAmount: number;
  userShare: number;
  percentage: number;
}

interface MonthlyTrend {
  monthKey: string; // 'YYYY-MM'
  label: string;    // 'Nov'
  year: number;
  month: number;
  totalSpend: number;
  userShare: number;
}

interface MemberSpending {
  uid: string;
  name: string;
  amountPaid: number;
  percentage: number;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  'food': { label: 'Food & Dining', icon: 'restaurant', color: '#F97316' },
  'travel': { label: 'Travel & Transport', icon: 'directions-car', color: '#0EA5E9' },
  'rent': { label: 'Rent & Housing', icon: 'home', color: '#8B5CF6' },
  'fun': { label: 'Entertainment & Fun', icon: 'movie', color: '#EC4899' },
  'shopping': { label: 'Shopping', icon: 'shopping-bag', color: '#10B981' },
  'health': { label: 'Health & Medical', icon: 'medical-services', color: '#EF4444' },
  'other': { label: 'Other', icon: 'category', color: '#64748B' },
};

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
  const [allExpenses, setAllExpenses] = useState<ExpenseData[]>([]);
  const [allSettlements, setAllSettlements] = useState<SettlementData[]>([]);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  // Group Map for quick lookup
  const groupMap = useMemo(() => {
    const map = new Map<string, GroupData>();
    activeGroups.forEach(g => {
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

  // Subscribe to expenses and settlements across target groups
  useEffect(() => {
    if (groupsLoading) return;

    const targetGroupIds = selectedGroupId === 'all'
      ? activeGroups.map(g => g.groupId).filter((id): id is string => !!id)
      : [selectedGroupId];

    if (targetGroupIds.length === 0) {
      setAllExpenses([]);
      setAllSettlements([]);
      setExpensesLoading(false);
      return;
    }

    setExpensesLoading(true);

    // Batch in chunks of 30 for Firestore 'in' query limit
    const chunks: string[][] = [];
    for (let i = 0; i < targetGroupIds.length; i += 30) {
      chunks.push(targetGroupIds.slice(i, i + 30));
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
      unsubs.forEach(u => u());
    };
  }, [selectedGroupId, activeGroups, groupsLoading]);

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

  // Filter expenses by selected date range
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(matchesDateFilter);
  }, [allExpenses, matchesDateFilter]);

  // Filter settlements by selected date range
  const filteredSettlements = useMemo(() => {
    return allSettlements.filter(matchesDateFilter);
  }, [allSettlements, matchesDateFilter]);

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

  // Monthly trends (Last 6 months)
  const monthlyTrends = useMemo((): MonthlyTrend[] => {
    const now = new Date();
    const months: MonthlyTrend[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 5; i >= 0; i--) {
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
      const userShare = (!isExcludedPreJoin && splits[currentUid]) ? Number(splits[currentUid]) || 0 : 0;

      const target = months.find((m) => m.monthKey === bMonth);
      if (target) {
        target.totalSpend += expAmount;
        target.userShare += userShare;
      }
    });

    return months;
  }, [allExpenses, groupMap, currentUid]);

  // Month-over-month comparison (Current vs Previous)
  const monthComparison = useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    const currentMonthData = monthlyTrends[monthlyTrends.length - 1];
    const prevMonthData = monthlyTrends[monthlyTrends.length - 2];

    const currentVal = currentMonthData.userShare;
    const prevVal = prevMonthData.userShare;

    if (prevVal === 0) {
      if (currentVal === 0) return { changePercent: 0, direction: 'flat', prevVal, currentVal };
      return { changePercent: 100, direction: 'up', prevVal, currentVal };
    }

    const diff = currentVal - prevVal;
    const percent = Math.round((Math.abs(diff) / prevVal) * 100);
    const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';

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

  // Group-level breakdown for "All Groups" view
  const allGroupsBreakdown = useMemo(() => {
    if (selectedGroupId !== 'all') return [];

    const breakdownMap = new Map<string, { totalSpend: number; userShare: number; groupName: string }>();

    activeGroups.forEach(g => {
      if (g.groupId) {
        breakdownMap.set(g.groupId, {
          totalSpend: 0,
          userShare: 0,
          groupName: g.name || 'Unnamed Group',
        });
      }
    });

    filteredExpenses.forEach((exp) => {
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
        totalSpend: Math.round(info.totalSpend * 100) / 100,
        userShare: Math.round(info.userShare * 100) / 100,
        balance: groupBalances[gId] || 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [selectedGroupId, activeGroups, filteredExpenses, groupMap, currentUid, groupBalances]);

  // Individual group member-wise spending & top 3 expenses
  const individualGroupDetails = useMemo(() => {
    if (selectedGroupId === 'all') return null;

    const currentGroup = groupMap.get(selectedGroupId);
    const memberPaidMap = new Map<string, number>();

    // Initialize all known members
    if (currentGroup?.memberIds) {
      currentGroup.memberIds.forEach((id) => memberPaidMap.set(id, 0));
    }

    filteredExpenses.forEach((exp) => {
      const currentPaid = memberPaidMap.get(exp.paidBy) || 0;
      memberPaidMap.set(exp.paidBy, currentPaid + (Number(exp.amount) || 0));
    });

    const totalGroupSpend = overviewMetrics.totalSpending || 1;
    const memberBreakdown: MemberSpending[] = Array.from(memberPaidMap.entries())
      .map(([mUid, paid]) => {
        const profile = groupMembers.find((m) => m.uid === mUid);
        const name = mUid === currentUid ? 'You' : profile?.name || 'Member';
        const percentage = Math.round((paid / totalGroupSpend) * 100);
        return {
          uid: mUid,
          name,
          amountPaid: Math.round(paid * 100) / 100,
          percentage,
        };
      })
      .sort((a, b) => b.amountPaid - a.amountPaid);

    // Top 3 highest expenses in selected period
    const topExpenses = [...filteredExpenses]
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 3);

    let groupUserSent = 0;
    let groupUserReceived = 0;
    filteredSettlements.forEach((s) => {
      if (s.groupId === selectedGroupId && (s.status === 'completed' || !s.status)) {
        if (s.fromUserId === currentUid) groupUserSent += Number(s.amount) || 0;
        if (s.toUserId === currentUid) groupUserReceived += Number(s.amount) || 0;
      }
    });

    let groupYouPaid = 0;
    let groupYourShare = 0;
    filteredExpenses.forEach((exp) => {
      if (exp.groupId === selectedGroupId) {
        if (exp.paidBy === currentUid) groupYouPaid += Number(exp.amount) || 0;
        const splits = getEffectiveSplitDetails(exp, currentGroup);
        if (splits[currentUid]) groupYourShare += Number(splits[currentUid]) || 0;
      }
    });

    const calculatedGroupBalance = dateFilter === 'all_time'
      ? (groupBalances[selectedGroupId] ?? Math.round((groupYouPaid - groupYourShare + groupUserSent - groupUserReceived) * 100) / 100)
      : Math.round((groupYouPaid - groupYourShare + groupUserSent - groupUserReceived) * 100) / 100;

    return {
      groupName: currentGroup?.name || 'Group',
      groupBalance: calculatedGroupBalance,
      memberBreakdown,
      topExpenses,
    };
  }, [selectedGroupId, groupMap, filteredExpenses, filteredSettlements, dateFilter, overviewMetrics.totalSpending, groupMembers, currentUid, groupBalances]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Firestore subscriptions update automatically, reset refreshing after brief pulse
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

  const maxMonthValue = useMemo(() => {
    const max = Math.max(...monthlyTrends.map((m) => m.totalSpend), 1);
    return max;
  }, [monthlyTrends]);

  const selectedMonthTrend = selectedMonthIndex !== null ? monthlyTrends[selectedMonthIndex] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8, backgroundColor: colors.surfaceContainerLowest, borderBottomColor: colors.divider }]}>
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

        {/* Group Filter Selector */}
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
                : [styles.groupChipInactive, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider }],
            ]}
            onPress={() => setSelectedGroupId('all')}
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
                    : [styles.groupChipInactive, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider }],
                ]}
                onPress={() => setSelectedGroupId(g.groupId)}
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

        {/* Date Range Filter Bar */}
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
                  isActive && [styles.dateFilterTabActive, { borderColor: colors.primary, backgroundColor: colors.primary + '12' }],
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Section A: Overview Metrics Cards */}
          <View style={styles.metricsGrid}>
            {/* Card 1: Total Group Spending */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
              ]}
            >
              <View style={styles.metricCardTop}>
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Total Spending</Text>
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
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>You Paid</Text>
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
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Your Share</Text>
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
                <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Net Balance</Text>
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
                  ? 'Add your first expense to this group to see detailed breakdown and insights.'
                  : 'Record expenses across your groups to unlock monthly trends and category breakdowns.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddExpense}
                activeOpacity={0.8}
              >
                <MaterialIcons name="add" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.emptyAddBtnText, { color: colors.onPrimary }]}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Section B: Spending Trends Bar Chart */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                      Monthly Spending Trends
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                      Last 6 months overview
                    </Text>
                  </View>

                  {monthComparison && (
                    <View
                      style={[
                        styles.trendBadge,
                        {
                          backgroundColor:
                            monthComparison.direction === 'up'
                              ? '#F59E0B' + '20'
                              : monthComparison.direction === 'down'
                              ? '#10B981' + '20'
                              : colors.surfaceContainerLow,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={
                          monthComparison.direction === 'up'
                            ? 'north'
                            : monthComparison.direction === 'down'
                            ? 'south'
                            : 'remove'
                        }
                        size={12}
                        color={
                          monthComparison.direction === 'up'
                            ? '#F59E0B'
                            : monthComparison.direction === 'down'
                            ? '#10B981'
                            : colors.onSurfaceVariant
                        }
                      />
                      <Text
                        style={[
                          styles.trendBadgeText,
                          {
                            color:
                              monthComparison.direction === 'up'
                                ? '#F59E0B'
                                : monthComparison.direction === 'down'
                                ? '#10B981'
                                : colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {monthComparison.direction === 'flat'
                          ? '0% vs last mo'
                          : `${monthComparison.changePercent}% vs last mo`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Vertical Bar Chart */}
                <View style={styles.chartContainer}>
                  <View style={styles.barsRow}>
                    {monthlyTrends.map((trend, index) => {
                      const isSelected = selectedMonthIndex === index;
                      const heightPercent = maxMonthValue > 0 ? (trend.totalSpend / maxMonthValue) * 100 : 0;
                      const barHeight = Math.max(12, (heightPercent / 100) * 110);

                      return (
                        <TouchableOpacity
                          key={trend.monthKey}
                          style={styles.barColumn}
                          onPress={() =>
                            setSelectedMonthIndex(isSelected ? null : index)
                          }
                          activeOpacity={0.8}
                        >
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: barHeight,
                                  backgroundColor: isSelected ? colors.secondary : colors.primary,
                                  opacity: isSelected ? 1 : 0.85,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.barLabel,
                              {
                                color: isSelected ? colors.primary : colors.onSurfaceVariant,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {trend.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Selected Month Detail Highlight */}
                {selectedMonthTrend && (
                  <View
                    style={[
                      styles.selectedMonthBox,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.primary },
                    ]}
                  >
                    <View style={styles.selectedMonthHeader}>
                      <Text style={[styles.selectedMonthTitle, { color: colors.onSurface }]}>
                        {selectedMonthTrend.label} {selectedMonthTrend.year} Details
                      </Text>
                      <TouchableOpacity onPress={() => setSelectedMonthIndex(null)}>
                        <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.selectedMonthValues}>
                      <View>
                        <Text style={[styles.selectedMonthSub, { color: colors.onSurfaceVariant }]}>Total Spend</Text>
                        <Text style={[styles.selectedMonthVal, { color: colors.onSurface }]}>
                          {formatCurrency(selectedMonthTrend.totalSpend)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.selectedMonthSub, { color: colors.onSurfaceVariant }]}>Your Share</Text>
                        <Text style={[styles.selectedMonthVal, { color: colors.primary }]}>
                          {formatCurrency(selectedMonthTrend.userShare)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Section C: Category Breakdown */}
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
                      Spending by activity
                    </Text>
                  </View>
                  <Text style={[styles.categoryCount, { color: colors.onSurfaceVariant }]}>
                    {categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'category' : 'categories'}
                  </Text>
                </View>

                <View style={styles.categoryList}>
                  {categoryBreakdown.map((item) => (
                    <View key={item.category} style={styles.categoryRow}>
                      <View style={styles.categoryTopLine}>
                        <View style={styles.categoryTitleGroup}>
                          <View
                            style={[
                              styles.categoryIconCircle,
                              { backgroundColor: item.color + '18' },
                            ]}
                          >
                            <MaterialIcons name={item.icon as any} size={16} color={item.color} />
                          </View>
                          <Text style={[styles.categoryName, { color: colors.onSurface }]}>
                            {item.label}
                          </Text>
                        </View>
                        <View style={styles.categoryAmountGroup}>
                          <Text style={[styles.categoryTotalAmount, { color: colors.onSurface }]}>
                            {formatCurrency(item.totalAmount)}
                          </Text>
                          <Text style={[styles.categoryPercentage, { color: colors.onSurfaceVariant }]}>
                            {item.percentage}%
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceContainerLow }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.min(100, Math.max(3, item.percentage))}%`,
                              backgroundColor: item.color,
                            },
                          ]}
                        />
                      </View>

                      {/* Subtle user share indicator */}
                      <View style={styles.categoryFooterRow}>
                        <Text style={[styles.categoryShareLabel, { color: colors.onSurfaceVariant }]}>
                          Your Share: <Text style={{ color: colors.primary, fontWeight: '600' }}>{formatCurrency(item.userShare)}</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Section D: Group Analysis */}
              {selectedGroupId === 'all' ? (
                /* All Groups List Breakdown */
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                        Active Groups Analysis
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                        Spending per group in selected range
                      </Text>
                    </View>
                  </View>

                  <View style={styles.groupList}>
                    {allGroupsBreakdown.map((g) => (
                      <TouchableOpacity
                        key={g.groupId}
                        style={[
                          styles.groupAnalysisItem,
                          { borderColor: colors.divider, backgroundColor: colors.surfaceContainerLow },
                        ]}
                        onPress={() => setSelectedGroupId(g.groupId)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.groupAnalysisLeft}>
                          <View
                            style={[
                              styles.groupAnalysisIcon,
                              { backgroundColor: colors.primary + '18' },
                            ]}
                          >
                            <MaterialIcons name="groups" size={20} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.groupAnalysisName, { color: colors.onSurface }]}
                              numberOfLines={1}
                            >
                              {g.groupName}
                            </Text>
                            <Text style={[styles.groupAnalysisSub, { color: colors.onSurfaceVariant }]}>
                              Your Share: {formatCurrency(g.userShare)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.groupAnalysisRight}>
                          <Text style={[styles.groupAnalysisTotal, { color: colors.onSurface }]}>
                            {formatCurrency(g.totalSpend)}
                          </Text>
                          <Text
                            style={[
                              styles.groupAnalysisBalance,
                              {
                                color:
                                  g.balance > 0
                                    ? '#10B981'
                                    : g.balance < 0
                                    ? '#F59E0B'
                                    : colors.onSurfaceVariant,
                              },
                            ]}
                          >
                            {g.balance > 0
                              ? `+${formatCurrency(g.balance)}`
                              : g.balance < 0
                              ? `-${formatCurrency(Math.abs(g.balance))}`
                              : 'Settled'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                /* Individual Group View: Member Breakdown & Top 3 Expenses */
                individualGroupDetails && (
                  <>
                    {/* Member-wise spending */}
                    <View
                      style={[
                        styles.sectionCard,
                        { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                      ]}
                    >
                      <View style={styles.sectionHeaderRow}>
                        <View>
                          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                            Member Spending Breakdown
                          </Text>
                          <Text style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}>
                            Who paid what in {individualGroupDetails.groupName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.memberList}>
                        {individualGroupDetails.memberBreakdown.map((m) => (
                          <View key={m.uid} style={styles.memberRow}>
                            <View style={styles.memberInfo}>
                              <View
                                style={[
                                  styles.memberAvatarCircle,
                                  {
                                    backgroundColor:
                                      m.uid === currentUid ? colors.primary + '20' : colors.surfaceContainerHigh,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.memberAvatarText,
                                    { color: m.uid === currentUid ? colors.primary : colors.onSurface },
                                  ]}
                                >
                                  {m.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View>
                                <Text
                                  style={[
                                    styles.memberName,
                                    { color: colors.onSurface },
                                    m.uid === currentUid && { fontWeight: '700', color: colors.primary },
                                  ]}
                                >
                                  {m.name}
                                </Text>
                                <Text style={[styles.memberPct, { color: colors.onSurfaceVariant }]}>
                                  {m.percentage}% of total group spend
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.memberAmount, { color: colors.onSurface }]}>
                              {formatCurrency(m.amountPaid)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Top 3 Highest Expenses */}
                    {individualGroupDetails.topExpenses.length > 0 && (
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
                          {individualGroupDetails.topExpenses.map((exp, idx) => {
                            const norm = normalizeCategory(exp.category);
                            return (
                              <TouchableOpacity
                                key={exp.expenseId || String(idx)}
                                style={[
                                  styles.topExpenseRow,
                                  { borderColor: colors.divider, backgroundColor: colors.surfaceContainerLow },
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
                                    <Text style={[styles.topExpenseMeta, { color: colors.onSurfaceVariant }]}>
                                      Paid by {exp.paidByName || (exp.paidBy === currentUid ? 'You' : 'Member')} •{' '}
                                      {formatFirestoreDate(exp.createdAt, exp.date)}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.topExpenseAmount, { color: colors.onSurface }]}>
                                  {formatCurrency(exp.amount)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </>
                )
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
    gap: Spacing.md,
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartContainer: {
    paddingVertical: Spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barTrack: {
    width: 22,
    height: 110,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 11,
  },
  selectedMonthBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  selectedMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedMonthTitle: {
    fontWeight: '700',
    fontSize: 12,
  },
  selectedMonthValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedMonthSub: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  selectedMonthVal: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  categoryCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryList: {
    gap: Spacing.md,
  },
  categoryRow: {
    gap: 6,
  },
  categoryTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryAmountGroup: {
    alignItems: 'flex-end',
  },
  categoryTotalAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPercentage: {
    fontSize: 10,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  categoryShareLabel: {
    fontSize: 11,
  },
  groupList: {
    gap: Spacing.xs,
  },
  groupAnalysisItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  groupAnalysisLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  groupAnalysisIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAnalysisName: {
    fontSize: 13,
    fontWeight: '700',
  },
  groupAnalysisSub: {
    fontSize: 11,
    marginTop: 2,
  },
  groupAnalysisRight: {
    alignItems: 'flex-end',
  },
  groupAnalysisTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupAnalysisBalance: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  memberList: {
    gap: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memberAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberPct: {
    fontSize: 10,
  },
  memberAmount: {
    fontSize: 13,
    fontWeight: '700',
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
